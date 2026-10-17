using NAudio.CoreAudioApi;
using NAudio.Wave;
using System.Text.Json;
using Teoleevo.AudioCapture;

try
{
    var options = Options.Parse(args);
    using var enumerator = new MMDeviceEnumerator();
    var devices = enumerator
        .EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active)
        .ToList();
    var defaultDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);

    Protocol.Write(new
    {
        type = "devices",
        devices = devices.Select(device => new
        {
            id = device.ID,
            name = device.FriendlyName,
            isDefault = device.ID == defaultDevice.ID,
        }),
    });

    var selectedDevice = options.DeviceId is null
        ? defaultDevice
        : devices.FirstOrDefault(device => device.ID == options.DeviceId)
            ?? throw new ArgumentException("La sortie audio demandée n’est plus disponible.");

    const int sampleRate = 48_000;
    const int channels = 2;
    var format = WaveFormat.CreateIeeeFloatWaveFormat(sampleRate, channels);
    var analyzer = new SpectrumAnalyzer(sampleRate, channels, options.FftSize);
    // Declared before the recorder so it is disposed after the recorder's
    // RecordingStopped event has finished (using declarations unwind in reverse).
    using var cancellation = new CancellationTokenSource();
    using var recorder = new LowLatencyLoopbackCapture(selectedDevice, 20)
    {
        WaveFormat = format,
    };
    using var soundCuePlayer = new SoundCuePlayer(selectedDevice);
    Console.CancelKeyPress += (_, eventArgs) =>
    {
        eventArgs.Cancel = true;
        cancellation.Cancel();
    };

    recorder.DataAvailable += (_, eventArgs) =>
    {
        var buffer = eventArgs.Buffer.AsSpan(0, eventArgs.BytesRecorded);
        analyzer.Add(buffer);
    };
    recorder.RecordingStopped += (_, eventArgs) =>
    {
        if (eventArgs.Exception is not null)
        {
            Protocol.Error(eventArgs.Exception.Message);
        }
        cancellation.Cancel();
    };

    recorder.StartRecording();
    Protocol.Write(new
    {
        type = "ready",
        deviceId = selectedDevice.ID,
        deviceName = selectedDevice.FriendlyName,
        sampleRate,
        channels,
        fftSize = options.FftSize,
    });

    _ = Task.Run(async () =>
    {
        while (!cancellation.IsCancellationRequested)
        {
            var command = await Console.In.ReadLineAsync(cancellation.Token);
            if (command is null || command.Equals("quit", StringComparison.OrdinalIgnoreCase))
            {
                cancellation.Cancel();
                break;
            }
            try
            {
                using var document = JsonDocument.Parse(command);
                var root = document.RootElement;
                if (
                    root.TryGetProperty("type", out var type) &&
                    type.GetString() == "play-sound" &&
                    root.TryGetProperty("sound", out var sound) &&
                    sound.GetString() is { } soundName)
                {
                    soundCuePlayer.Play(soundName);
                }
            }
            catch (Exception exception) when (
                exception is not OperationCanceledException &&
                !cancellation.IsCancellationRequested)
            {
                // Sound cues are an optional Telegram-only convenience. A playback
                // failure must never stop loopback capture or put the main UI in an
                // error state.
                Console.Error.WriteLine($"Sound cue ignored: {exception.Message}");
            }
        }
    }, cancellation.Token);

    using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1d / options.Fps));
    while (await timer.WaitForNextTickAsync(cancellation.Token))
    {
        var snapshot = analyzer.Snapshot();
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var hasSignal =
            snapshot.UpdatedAt > 0 &&
            now - snapshot.UpdatedAt < 300 &&
            snapshot.LoudnessDb > -85;
        Protocol.Write(new
        {
            type = "frame",
            timestamp = now,
            hasSignal,
            db = new
            {
                bass = hasSignal ? snapshot.BassDb : -120,
                mids = hasSignal ? snapshot.MidsDb : -120,
                treble = hasSignal ? snapshot.TrebleDb : -120,
            },
        });
    }

    recorder.StopRecording();
}
catch (OperationCanceledException)
{
    // Normal shutdown requested by the parent process.
}
catch (Exception exception)
{
    Protocol.Error(exception.Message);
    Console.Error.WriteLine(exception);
    Environment.ExitCode = 1;
}
