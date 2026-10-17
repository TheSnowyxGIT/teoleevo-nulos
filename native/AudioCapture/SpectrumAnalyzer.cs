using System.Runtime.InteropServices;

namespace Teoleevo.AudioCapture;

internal sealed record SpectrumSnapshot(
    double BassDb,
    double MidsDb,
    double TrebleDb,
    double LoudnessDb,
    double SubBassDb,
    double LowMidDb,
    double HighMidDb,
    double SpectralCentroid,
    double SpectralFlux,
    long UpdatedAt);

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
    private readonly double[] previousMagnitudes;
    private readonly double windowEnergy;
    private int writeIndex;
    private int availableSamples;
    private int samplesSinceAnalysis;
    private SpectrumSnapshot latest = new(
        -120, -120, -120, -120, -120, -120, -120, 0, 0, 0);

    public SpectrumAnalyzer(int sampleRate, int channels, int fftSize)
    {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.fftSize = fftSize;
        hopSize = fftSize / 4;
        ring = new float[fftSize];
        real = new double[fftSize];
        imaginary = new double[fftSize];
        previousMagnitudes = new double[fftSize / 2 + 1];
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

    public SpectrumSnapshot Snapshot()
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

        var loudnessDb = RmsDb();
        Fft.Transform(real, imaginary);
        var (centroid, flux) = SpectralShape();
        latest = new SpectrumSnapshot(
            BandDb(20, 250),
            BandDb(250, 4_000),
            BandDb(4_000, Math.Min(16_000, sampleRate / 2)),
            loudnessDb,
            BandDb(20, 90),
            BandDb(250, 2_000),
            BandDb(2_000, 8_000),
            centroid,
            flux,
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    }

    private double RmsDb()
    {
        double squared = 0;
        for (var index = 0; index < fftSize; index++)
        {
            var sample = ring[index];
            squared += sample * sample;
        }

        return Math.Clamp(
            10 * Math.Log10(Math.Max(MinimumPower, squared / fftSize)),
            -120,
            0);
    }

    private (double Centroid, double Flux) SpectralShape()
    {
        double weightedFrequency = 0;
        double magnitudeSum = 0;
        double positiveFlux = 0;

        for (var bin = 1; bin <= fftSize / 2; bin++)
        {
            var magnitude = Math.Sqrt(real[bin] * real[bin] + imaginary[bin] * imaginary[bin]);
            var frequency = (double)bin * sampleRate / fftSize;
            magnitudeSum += magnitude;
            weightedFrequency += frequency * magnitude;
            positiveFlux += Math.Max(0, magnitude - previousMagnitudes[bin]);
            previousMagnitudes[bin] = magnitude;
        }

        var centroid = magnitudeSum > 0 ? weightedFrequency / magnitudeSum : 0;
        var flux = magnitudeSum > 0 ? positiveFlux / magnitudeSum : 0;
        return (centroid, Math.Clamp(flux, 0, 1));
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
