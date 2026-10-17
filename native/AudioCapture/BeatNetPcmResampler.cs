using System.Runtime.InteropServices;

namespace Teoleevo.AudioCapture;

/// <summary>
/// Converts the 48 kHz stereo loopback stream to the exact 22.05 kHz mono,
/// 20 ms float32 hops expected by BeatNet. The linear interpolator retains its
/// phase and boundary sample across WASAPI callbacks.
/// </summary>
internal sealed class BeatNetPcmResampler
{
    private const int SourceRate = 48_000;
    private const int TargetRate = 22_050;
    private const int HopSamples = 441;
    private const double SourceStep = (double)SourceRate / TargetRate;
    private readonly List<float> output = new(HopSamples * 2);
    private double sourcePosition;
    private float previousSample;
    private bool hasPrevious;

    public void Add(ReadOnlySpan<byte> buffer, Action<byte[]> onHop)
    {
        var stereo = MemoryMarshal.Cast<byte, float>(buffer);
        var frameCount = stereo.Length / 2;
        if (frameCount == 0)
        {
            return;
        }

        var mono = new float[frameCount + (hasPrevious ? 1 : 0)];
        var destination = 0;
        if (hasPrevious)
        {
            mono[destination++] = previousSample;
        }

        for (var frame = 0; frame < frameCount; frame++)
        {
            mono[destination++] = (stereo[frame * 2] + stereo[frame * 2 + 1]) * 0.5f;
        }

        if (!hasPrevious)
        {
            hasPrevious = true;
        }

        while (sourcePosition < mono.Length - 1)
        {
            var left = (int)sourcePosition;
            var fraction = sourcePosition - left;
            output.Add((float)(mono[left] + (mono[left + 1] - mono[left]) * fraction));
            sourcePosition += SourceStep;

            if (output.Count == HopSamples)
            {
                var samples = output.ToArray();
                onHop(MemoryMarshal.AsBytes(samples.AsSpan()).ToArray());
                output.Clear();
            }
        }

        sourcePosition -= mono.Length - 1;
        previousSample = mono[^1];
    }
}
