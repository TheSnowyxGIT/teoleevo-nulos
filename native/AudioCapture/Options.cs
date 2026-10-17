namespace Teoleevo.AudioCapture;

internal sealed record Options(string? DeviceId, int FftSize, int Fps, bool BeatNetPcm)
{
    public static Options Parse(string[] args)
    {
        string? deviceId = null;
        var fftSize = 2048;
        var fps = 30;
        var beatNetPcm = false;

        for (var index = 0; index < args.Length; index++)
        {
            switch (args[index])
            {
                case "--device-id":
                    deviceId = ReadValue(args, ref index);
                    break;
                case "--fft-size":
                    fftSize = int.Parse(ReadValue(args, ref index));
                    break;
                case "--fps":
                    fps = int.Parse(ReadValue(args, ref index));
                    break;
                case "--beatnet-pcm":
                    beatNetPcm = true;
                    break;
                default:
                    throw new ArgumentException($"Option inconnue: {args[index]}");
            }
        }

        if (fftSize is not (1024 or 2048 or 4096))
        {
            throw new ArgumentException("La taille FFT doit être 1024, 2048 ou 4096.");
        }

        if (fps is < 10 or > 60)
        {
            throw new ArgumentException("Le rafraîchissement doit être compris entre 10 et 60 FPS.");
        }

        return new Options(deviceId, fftSize, fps, beatNetPcm);
    }

    private static string ReadValue(string[] args, ref int index)
    {
        index += 1;
        if (index >= args.Length)
        {
            throw new ArgumentException("Valeur manquante dans les options du helper.");
        }

        return args[index];
    }
}
