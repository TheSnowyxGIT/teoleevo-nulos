using System.Runtime.InteropServices;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Teoleevo.Visualizer;

internal sealed class ProjectMEngine : IDisposable
{
    private IntPtr _handle;
    private readonly string _presetCacheDirectory;
    private double _speed;
    private double _audioGain;

    private static readonly Regex Assignment = new(
        @"(?m)^(?<key>[^=\r\n]+)=(?<value>[^\r\n]*)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex TimeToken = new(
        @"(?<![A-Za-z0-9_])time(?![A-Za-z0-9_])",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    private static readonly Regex FrameToken = new(
        @"(?<![A-Za-z0-9_])frame(?![A-Za-z0-9_])",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    private static readonly Regex AudioToken = new(
        @"(?<![A-Za-z0-9_])(?<band>bass_att|bass|mid_att|mid|treb_att|treb)(?![A-Za-z0-9_])",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    private static readonly Regex MotionAssignment = new(
        @"(?<prefix>(?:^|;)\s*)(?<name>zoom|rot|sx|sy|dx|dy)\s*=\s*(?<expression>[^;]*)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    public ProjectMEngine(
        IReadOnlyList<string> textureDirectories,
        int width,
        int height,
        int frameRate,
        double speed,
        double audioGain)
    {
        Configure(
            frameRate,
            speed,
            audioGain,
            updateEngine: false);
        _presetCacheDirectory = Path.Combine(
            Path.GetTempPath(),
            "teoleevo-visualizer",
            Environment.ProcessId.ToString(CultureInfo.InvariantCulture));
        Directory.CreateDirectory(_presetCacheDirectory);
        _handle = NativeMethods.projectm_create();
        if (_handle == IntPtr.Zero)
        {
            throw new InvalidOperationException(
                "libprojectM n’a pas pu démarrer. Le contexte OpenGL 3.3 est peut-être indisponible.");
        }

        NativeMethods.projectm_set_window_size(_handle, (UIntPtr)(uint)width, (UIntPtr)(uint)height);
        NativeMethods.projectm_set_fps(_handle, frameRate);
        NativeMethods.projectm_set_soft_cut_duration(_handle, 1.5);
        NativeMethods.projectm_set_preset_duration(_handle, 86_400);
        NativeMethods.projectm_set_preset_locked(_handle, true);
        NativeMethods.projectm_set_hard_cut_enabled(_handle, false);
        SetTextureDirectories(textureDirectories);
    }

    public void Resize(int width, int height) =>
        NativeMethods.projectm_set_window_size(_handle, (UIntPtr)(uint)width, (UIntPtr)(uint)height);

    public void LoadPreset(string path, bool smoothTransition)
    {
        var absolutePath = Path.GetFullPath(path);
        if (!File.Exists(absolutePath))
        {
            throw new FileNotFoundException("Preset introuvable.", absolutePath);
        }
        var renderPath = HasNeutralTuning()
            ? absolutePath
            : CreateTunedPreset(absolutePath);
        NativeMethods.projectm_load_preset_file(_handle, renderPath, smoothTransition);
    }

    public bool Configure(
        int frameRate,
        double speed,
        double audioGain)
    {
        var presetNeedsReload = _speed != speed || _audioGain != audioGain;
        Configure(frameRate, speed, audioGain, updateEngine: true);
        return presetNeedsReload;
    }

    public void AddAudio(float[] samples)
    {
        const int channels = 2;
        if (_audioGain != 1.0)
        {
            var gain = (float)_audioGain;
            for (var index = 0; index < samples.Length; index++)
            {
                samples[index] *= gain;
            }
        }
        NativeMethods.projectm_pcm_add_float(_handle, samples, (uint)(samples.Length / channels), channels);
    }

    public void Render() => NativeMethods.projectm_opengl_render_frame(_handle);

    public void Dispose()
    {
        if (_handle == IntPtr.Zero)
        {
            return;
        }
        NativeMethods.projectm_destroy(_handle);
        _handle = IntPtr.Zero;
        try
        {
            Directory.Delete(_presetCacheDirectory, true);
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private void SetTextureDirectories(IReadOnlyList<string> directories)
    {
        if (directories.Count == 0)
        {
            return;
        }

        var strings = directories.Select(Marshal.StringToCoTaskMemUTF8).ToArray();
        var array = Marshal.AllocHGlobal(IntPtr.Size * strings.Length);
        try
        {
            Marshal.Copy(strings, 0, array, strings.Length);
            NativeMethods.projectm_set_texture_search_paths(_handle, array, (UIntPtr)(uint)strings.Length);
        }
        finally
        {
            Marshal.FreeHGlobal(array);
            foreach (var pointer in strings)
            {
                Marshal.FreeCoTaskMem(pointer);
            }
        }
    }

    private string CreateTunedPreset(string sourcePath)
    {
        // Latin-1 gives a lossless byte-to-character mapping for legacy MilkDrop files.
        var source = Encoding.Latin1.GetString(File.ReadAllBytes(sourcePath));
        var factor = _speed.ToString("0.####", CultureInfo.InvariantCulture);
        var transformed = Assignment.Replace(source, match =>
        {
            var key = match.Groups["key"].Value;
            var value = match.Groups["value"].Value;
            var normalizedKey = key.Trim();
            if (normalizedKey.Equals("fWarpAnimSpeed", StringComparison.OrdinalIgnoreCase) &&
                double.TryParse(value.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var warpSpeed))
            {
                value = (warpSpeed * _speed).ToString("0.######", CultureInfo.InvariantCulture);
            }
            else if (TryGetMotionNeutralValue(normalizedKey, out var neutral) &&
                     double.TryParse(value.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var motion))
            {
                value = (neutral + (motion - neutral) * _speed)
                    .ToString("0.######", CultureInfo.InvariantCulture);
            }
            else if (IsExpressionKey(normalizedKey))
            {
                value = ScaleMotionAssignments(value, factor);
                value = TimeToken.Replace(value, $"(time*{factor})");
                value = FrameToken.Replace(value, $"(frame*{factor})");
                var audioFactor = _audioGain.ToString("0.###", CultureInfo.InvariantCulture);
                value = AudioToken.Replace(value, match => $"({match.Value}*{audioFactor})");
            }
            return $"{key}={value}";
        });

        var targetPath = Path.Combine(_presetCacheDirectory, $"{Guid.NewGuid():N}.milk");
        File.WriteAllBytes(targetPath, Encoding.Latin1.GetBytes(transformed));
        return targetPath;
    }

    private static double ValidateSpeed(double speed)
    {
        if (double.IsNaN(speed) || double.IsInfinity(speed) || speed is < 0.0 or > 2.0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(speed),
                "La vitesse d’animation doit être comprise entre 0 et 2.");
        }
        return speed;
    }

    private void Configure(
        int frameRate,
        double speed,
        double audioGain,
        bool updateEngine)
    {
        if (frameRate is < 10 or > 120)
        {
            throw new ArgumentOutOfRangeException(nameof(frameRate), "Le framerate doit être compris entre 10 et 120 FPS.");
        }
        _speed = ValidateSpeed(speed);
        _audioGain = ValidateAudioGain(audioGain);
        if (updateEngine)
        {
            NativeMethods.projectm_set_fps(_handle, frameRate);
        }
    }

    private string ScaleMotionAssignments(string expressionLine, string factor)
    {
        return MotionAssignment.Replace(expressionLine, match =>
        {
            var name = match.Groups["name"].Value;
            var expression = match.Groups["expression"].Value.Trim();
            if (AudioToken.IsMatch(expression))
            {
                return match.Value;
            }

            var readsItself = Regex.IsMatch(
                expression,
                $@"(?<![A-Za-z0-9_]){Regex.Escape(name)}(?![A-Za-z0-9_])",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            var usesClock = TimeToken.IsMatch(expression) || FrameToken.IsMatch(expression);
            if (usesClock && !readsItself)
            {
                return match.Value;
            }

            var neutral = name.Equals("zoom", StringComparison.OrdinalIgnoreCase) ||
                          name.Equals("sx", StringComparison.OrdinalIgnoreCase) ||
                          name.Equals("sy", StringComparison.OrdinalIgnoreCase)
                ? "1"
                : "0";
            var scaled = readsItself
                ? $"{name}+(({expression})-{name})*{factor}"
                : $"{neutral}+(({expression})-{neutral})*{factor}";
            return $"{match.Groups["prefix"].Value}{name}={scaled}";
        });
    }

    private bool HasNeutralTuning() =>
        _speed == 1.0 && _audioGain == 1.0;

    private static bool TryGetMotionNeutralValue(string key, out double neutral)
    {
        if (key.Equals("zoom", StringComparison.OrdinalIgnoreCase) ||
            key.Equals("sx", StringComparison.OrdinalIgnoreCase) ||
            key.Equals("sy", StringComparison.OrdinalIgnoreCase))
        {
            neutral = 1.0;
            return true;
        }
        if (key.Equals("rot", StringComparison.OrdinalIgnoreCase) ||
            key.Equals("dx", StringComparison.OrdinalIgnoreCase) ||
            key.Equals("dy", StringComparison.OrdinalIgnoreCase))
        {
            neutral = 0.0;
            return true;
        }
        neutral = 0.0;
        return false;
    }

    private static bool IsExpressionKey(string key) =>
        key.StartsWith("per_frame_", StringComparison.OrdinalIgnoreCase) ||
        key.StartsWith("per_pixel_", StringComparison.OrdinalIgnoreCase) ||
        key.StartsWith("wave_", StringComparison.OrdinalIgnoreCase) ||
        key.StartsWith("shape_", StringComparison.OrdinalIgnoreCase) ||
        key.StartsWith("warp_", StringComparison.OrdinalIgnoreCase) ||
        key.StartsWith("comp_", StringComparison.OrdinalIgnoreCase);

    private static double ValidateAudioGain(double value)
    {
        if (double.IsNaN(value) || double.IsInfinity(value) || value is < 0.0 or > 8.0)
        {
            throw new ArgumentOutOfRangeException(nameof(value), "Le volume visuel doit être compris entre 0 et 8.");
        }
        return value;
    }
}
