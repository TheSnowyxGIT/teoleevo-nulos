using System.Collections.Concurrent;
using System.Diagnostics;

namespace Teoleevo.Visualizer;

internal sealed class RendererWindow : IDisposable
{
    private readonly Options _options;
    private readonly ConcurrentQueue<RendererCommand> _commands = new();
    private readonly CancellationTokenSource _cancellation = new();
    private IntPtr _window;
    private IntPtr _glContext;
    private string _currentPresetPath;
    private int _frameRate;

    public RendererWindow(Options options)
    {
        _options = options;
        _currentPresetPath = options.PresetPath;
        _frameRate = options.FrameRate;
    }

    public void Run()
    {
        InitializeWindow();
        using var engine = new ProjectMEngine(
            _options.TextureDirectories,
            _options.Width,
            _options.Height,
            _options.FrameRate,
            _options.Speed,
            _options.AudioGain);
        using var audio = new AudioLoopback();
        audio.SelectDevice(_options.DeviceId);
        engine.LoadPreset(_options.PresetPath, false);
        UpdateTitle(_options.PresetPath);
        StartCommandReader();

        Protocol.Write(new
        {
            type = "ready",
            presetPath = _options.PresetPath,
            deviceId = audio.DeviceId,
            deviceName = audio.DeviceName,
        });

        var width = 0;
        var height = 0;
        var clock = Stopwatch.StartNew();
        while (!_cancellation.IsCancellationRequested)
        {
            while (NativeMethods.SDL_PollEvent(out var sdlEvent) != 0)
            {
                if (sdlEvent.Type == NativeMethods.SdlQuit)
                {
                    _cancellation.Cancel();
                }
            }

            ProcessCommands(engine, audio);
            NativeMethods.SDL_GL_GetDrawableSize(_window, out var nextWidth, out var nextHeight);
            if (nextWidth != width || nextHeight != height)
            {
                width = nextWidth;
                height = nextHeight;
                engine.Resize(width, height);
            }

            audio.Feed(engine);
            engine.Render();
            NativeMethods.SDL_GL_SwapWindow(_window);

            var targetFrameMilliseconds = 1_000.0 / _frameRate;
            var remainingMilliseconds = targetFrameMilliseconds - clock.Elapsed.TotalMilliseconds;
            if (remainingMilliseconds > 1)
            {
                Thread.Sleep((int)Math.Floor(remainingMilliseconds));
            }
            clock.Restart();
        }
    }

    public void Dispose()
    {
        _cancellation.Cancel();
        if (_glContext != IntPtr.Zero)
        {
            NativeMethods.SDL_GL_DeleteContext(_glContext);
            _glContext = IntPtr.Zero;
        }
        if (_window != IntPtr.Zero)
        {
            NativeMethods.SDL_DestroyWindow(_window);
            _window = IntPtr.Zero;
        }
        NativeMethods.SDL_Quit();
        _cancellation.Dispose();
    }

    private void InitializeWindow()
    {
        if (!NativeMethods.SetDllDirectory(_options.RuntimeDirectory))
        {
            throw new InvalidOperationException("Impossible de configurer le dossier des DLL projectM.");
        }
        if (NativeMethods.SDL_Init(NativeMethods.SdlInitVideo) != 0)
        {
            throw new InvalidOperationException($"SDL_Init: {NativeMethods.SdlError()}");
        }

        NativeMethods.SDL_GL_SetAttribute(NativeMethods.SdlGlContextMajorVersion, 3);
        NativeMethods.SDL_GL_SetAttribute(NativeMethods.SdlGlContextMinorVersion, 3);
        NativeMethods.SDL_GL_SetAttribute(
            NativeMethods.SdlGlContextProfileMask,
            NativeMethods.SdlGlContextProfileCore);
        _window = NativeMethods.SDL_CreateWindow(
            "Teoleevo · projectM",
            NativeMethods.SdlWindowPositionCentered,
            NativeMethods.SdlWindowPositionCentered,
            _options.Width,
            _options.Height,
            NativeMethods.SdlWindowOpenGl |
            NativeMethods.SdlWindowResizable |
            NativeMethods.SdlWindowAllowHighDpi);
        if (_window == IntPtr.Zero)
        {
            throw new InvalidOperationException($"SDL_CreateWindow: {NativeMethods.SdlError()}");
        }

        _glContext = NativeMethods.SDL_GL_CreateContext(_window);
        if (_glContext == IntPtr.Zero)
        {
            throw new InvalidOperationException($"SDL_GL_CreateContext: {NativeMethods.SdlError()}");
        }
        if (NativeMethods.SDL_GL_MakeCurrent(_window, _glContext) != 0)
        {
            throw new InvalidOperationException($"SDL_GL_MakeCurrent: {NativeMethods.SdlError()}");
        }
        NativeMethods.SDL_GL_SetSwapInterval(1);
        var glewResult = NativeMethods.glewInit();
        if (glewResult != 0)
        {
            throw new InvalidOperationException($"glewInit a échoué (code {glewResult}).");
        }
    }

    private void StartCommandReader()
    {
        _ = Task.Run(async () =>
        {
            try
            {
                while (!_cancellation.IsCancellationRequested)
                {
                    var line = await Console.In.ReadLineAsync(_cancellation.Token);
                    if (line is null)
                    {
                        _commands.Enqueue(new RendererCommand(
                            "quit", null, null, false, null, null, null));
                        return;
                    }
                    try
                    {
                        _commands.Enqueue(RendererCommand.Parse(line));
                    }
                    catch (Exception exception)
                    {
                        Protocol.Error($"Commande invalide: {exception.Message}");
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
        }, _cancellation.Token);
    }

    private void ProcessCommands(ProjectMEngine engine, AudioLoopback audio)
    {
        while (_commands.TryDequeue(out var command))
        {
            try
            {
                switch (command.Type)
                {
                    case "preset" when command.Path is not null:
                        engine.LoadPreset(command.Path, command.Smooth);
                        _currentPresetPath = Path.GetFullPath(command.Path);
                        UpdateTitle(command.Path);
                        Protocol.Write(new { type = "preset", path = Path.GetFullPath(command.Path) });
                        break;
                    case "device":
                        audio.SelectDevice(command.DeviceId);
                        Protocol.Write(new
                        {
                            type = "device",
                            deviceId = audio.DeviceId,
                            deviceName = audio.DeviceName,
                        });
                        break;
                    case "settings" when command.FrameRate is not null &&
                                              command.Speed is not null &&
                                              command.AudioGain is not null:
                        var presetNeedsReload = engine.Configure(
                            command.FrameRate.Value,
                            command.Speed.Value,
                            command.AudioGain.Value);
                        _frameRate = command.FrameRate.Value;
                        if (presetNeedsReload)
                        {
                            engine.LoadPreset(_currentPresetPath, false);
                        }
                        Protocol.Write(new
                        {
                            type = "settings",
                            frameRate = command.FrameRate.Value,
                            speed = command.Speed.Value,
                            audioGain = command.AudioGain.Value,
                        });
                        break;
                    case "quit":
                        _cancellation.Cancel();
                        break;
                    default:
                        Protocol.Error($"Commande inconnue: {command.Type}");
                        break;
                }
            }
            catch (Exception exception)
            {
                Protocol.Error(exception.Message);
            }
        }
    }

    private void UpdateTitle(string presetPath)
    {
        var presetName = Path.GetFileNameWithoutExtension(presetPath);
        NativeMethods.SDL_SetWindowTitle(_window, $"Teoleevo · {presetName}");
    }
}
