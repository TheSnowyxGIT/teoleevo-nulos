namespace Teoleevo.Visualizer;

internal sealed record Options(
    string RuntimeDirectory,
    string PresetPath,
    IReadOnlyList<string> TextureDirectories,
    string? DeviceId,
    int Width,
    int Height)
{
    public static Options Parse(string[] args)
    {
        string? runtimeDirectory = null;
        string? presetPath = null;
        string? deviceId = null;
        var textureDirectories = new List<string>();
        var width = 1280;
        var height = 720;

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

        return new Options(
            Path.GetFullPath(runtimeDirectory),
            Path.GetFullPath(presetPath),
            textureDirectories.Select(Path.GetFullPath).ToArray(),
            deviceId,
            width,
            height);
    }
}
