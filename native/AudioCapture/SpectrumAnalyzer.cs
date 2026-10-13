using System.Runtime.InteropServices;

namespace Teoleevo.AudioCapture;

internal sealed record BandSnapshot(double BassDb, double MidsDb, double TrebleDb, long UpdatedAt);

internal sealed class SpectrumAnalyzer
{
    private const double MinimumPower = 1e-12;
    private readonly object gate = new();
    private readonly int sampleRate;
    private readonly int channels;
    private readonly int fftSize;
    private readonly int hopSize;
    private readonly float[] ring;
    private readonly double[] window;
    private readonly double[] real;
    private readonly double[] imaginary;
    private readonly double windowEnergy;
    private int writeIndex;
    private int availableSamples;
    private int samplesSinceAnalysis;
    private BandSnapshot latest = new(-120, -120, -120, 0);

    public SpectrumAnalyzer(int sampleRate, int channels, int fftSize)
    {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.fftSize = fftSize;
        hopSize = fftSize / 4;
        ring = new float[fftSize];
        real = new double[fftSize];
        imaginary = new double[fftSize];
        window = new double[fftSize];

        double energy = 0;
        for (var index = 0; index < fftSize; index++)
        {
            var value = 0.5 * (1 - Math.Cos(2 * Math.PI * index / (fftSize - 1)));
            window[index] = value;
            energy += value * value;
        }

        windowEnergy = energy;
    }

    public void Add(ReadOnlySpan<byte> buffer)
    {
        var samples = MemoryMarshal.Cast<byte, float>(buffer);
        lock (gate)
        {
            for (var offset = 0; offset + channels <= samples.Length; offset += channels)
            {
                double mono = 0;
                for (var channel = 0; channel < channels; channel++)
                {
                    mono += samples[offset + channel];
                }

                ring[writeIndex] = (float)(mono / channels);
                writeIndex = (writeIndex + 1) % fftSize;
                availableSamples = Math.Min(fftSize, availableSamples + 1);
                samplesSinceAnalysis += 1;

                if (availableSamples == fftSize && samplesSinceAnalysis >= hopSize)
                {
                    Analyze();
                    samplesSinceAnalysis = 0;
                }
            }
        }
    }

    public BandSnapshot Snapshot()
    {
        lock (gate)
        {
            return latest;
        }
    }

    private void Analyze()
    {
        for (var index = 0; index < fftSize; index++)
        {
            var sourceIndex = (writeIndex + index) % fftSize;
            real[index] = ring[sourceIndex] * window[index];
            imaginary[index] = 0;
        }

        Fft.Transform(real, imaginary);
        latest = new BandSnapshot(
            BandDb(20, 250),
            BandDb(250, 4_000),
            BandDb(4_000, Math.Min(16_000, sampleRate / 2)),
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    }

    private double BandDb(double minimumFrequency, double maximumFrequency)
    {
        var minimumBin = Math.Max(1, (int)Math.Ceiling(minimumFrequency * fftSize / sampleRate));
        var maximumBin = Math.Min(
            fftSize / 2,
            (int)Math.Floor(maximumFrequency * fftSize / sampleRate));
        double squaredMagnitude = 0;

        for (var bin = minimumBin; bin <= maximumBin; bin++)
        {
            squaredMagnitude += real[bin] * real[bin] + imaginary[bin] * imaginary[bin];
        }

        var power = 2 * squaredMagnitude / (fftSize * windowEnergy);
        return Math.Clamp(10 * Math.Log10(Math.Max(MinimumPower, power)), -120, 0);
    }
}

internal static class Fft
{
    public static void Transform(double[] real, double[] imaginary)
    {
        var length = real.Length;
        for (int current = 1, reversed = 0; current < length; current++)
        {
            var bit = length >> 1;
            while ((reversed & bit) != 0)
            {
                reversed ^= bit;
                bit >>= 1;
            }

            reversed ^= bit;
            if (current < reversed)
            {
                (real[current], real[reversed]) = (real[reversed], real[current]);
                (imaginary[current], imaginary[reversed]) =
                    (imaginary[reversed], imaginary[current]);
            }
        }

        for (var size = 2; size <= length; size <<= 1)
        {
            var angle = -2 * Math.PI / size;
            var stepReal = Math.Cos(angle);
            var stepImaginary = Math.Sin(angle);

            for (var start = 0; start < length; start += size)
            {
                double twiddleReal = 1;
                double twiddleImaginary = 0;
                for (var offset = 0; offset < size / 2; offset++)
                {
                    var even = start + offset;
                    var odd = even + size / 2;
                    var oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
                    var oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;

                    real[odd] = real[even] - oddReal;
                    imaginary[odd] = imaginary[even] - oddImaginary;
                    real[even] += oddReal;
                    imaginary[even] += oddImaginary;

                    var nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
                    twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
                    twiddleReal = nextReal;
                }
            }
        }
    }
}
