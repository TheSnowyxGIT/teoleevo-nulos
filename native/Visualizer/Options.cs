namespace Teoleevo.Visualizer;

internal sealed record Options(
    string RuntimeDirectory,
    string PresetPath,
    IReadOnlyList<string> TextureDirectories,
    string? DeviceId,
    int Width,
    int Height,
    int FrameRate,
    double Speed,
    double AudioGain)
{
    public static Options Parse(string[] args)
    {
        string? runtimeDirectory = null;
        string? presetPath = null;
        string? deviceId = null;
        var textureDirectories = new List<string>();
        var width = 1280;
        var height = 720;
        var frameRate = 30;
        var speed = 1.07175;
        var audioGain = 1.0;

        for (var index = 0; index < args.Length; index++)
        {
            var argument = args[index];
            string ReadValue()
            {
                if (++index >= args.Length)
                {
                    throw new ArgumentException($"Valeur manquante pour {argument}.");
                }
                return args[index];
            }

            switch (argument)
            {
                case "--runtime":
                    runtimeDirectory = ReadValue();
                    break;
                case "--preset":
                    presetPath = ReadValue();
                    break;
                case "--texture":
                    textureDirectories.Add(ReadValue());
                    break;
                case "--device-id":
                    deviceId = ReadValue();
                    break;
                case "--width":
                    width = int.Parse(ReadValue());
                    break;
                case "--height":
                    height = int.Parse(ReadValue());
                    break;
                case "--speed":
                    speed = double.Parse(
                        ReadValue(),
                        System.Globalization.CultureInfo.InvariantCulture);
                    break;
                case "--fps":
                    frameRate = int.Parse(ReadValue(), System.Globalization.CultureInfo.InvariantCulture);
                    break;
                case "--audio-gain":
                    audioGain = ParseDouble(ReadValue());
                    break;
                default:
                    throw new ArgumentException($"Option inconnue: {argument}.");
            }
        }

        if (runtimeDirectory is null || presetPath is null)
        {
            throw new ArgumentException("--runtime et --preset sont obligatoires.");
        }
        if (width < 320 || height < 240)
        {
            throw new ArgumentException("La fenêtre doit mesurer au moins 320 × 240 pixels.");
        }
        if (frameRate is < 10 or > 120)
        {
            throw new ArgumentException("Le framerate doit être compris entre 10 et 120 FPS.");
        }
        if (speed is < 0.0 or > 2.0)
        {
            throw new ArgumentException("La vitesse d’animation doit être comprise entre 0 et 2.");
        }
        if (audioGain is < 0.0 or > 8.0)
        {
            throw new ArgumentException("Le volume visuel doit être compris entre 0 et 8.");
        }

        return new Options(
            Path.GetFullPath(runtimeDirectory),
            Path.GetFullPath(presetPath),
            textureDirectories.Select(Path.GetFullPath).ToArray(),
            deviceId,
            width,
            height,
            frameRate,
            speed,
            audioGain);

        static double ParseDouble(string value) => double.Parse(
            value,
            System.Globalization.CultureInfo.InvariantCulture);
    }
}
