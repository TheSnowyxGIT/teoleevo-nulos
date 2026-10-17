using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace Teoleevo.AudioCapture;

internal sealed class SoundCuePlayer : IDisposable
{
    private const int SampleRate = 48_000;
    private const int Channels = 2;
    private static readonly WaveFormat Format =
        WaveFormat.CreateIeeeFloatWaveFormat(SampleRate, Channels);

    private readonly MMDevice _device;
    private readonly object _sync = new();
    private WasapiOut? _output;
    private RawSourceWaveStream? _stream;
    private int _generation;

    public SoundCuePlayer(MMDevice device)
    {
        _device = device;
    }

    public void Play(string name)
    {
        var cue = SoundCueSynthesizer.Create(name, SampleRate, Channels);
        var bytes = new byte[cue.Samples.Length * sizeof(float)];
        Buffer.BlockCopy(cue.Samples, 0, bytes, 0, bytes.Length);
        var stream = new RawSourceWaveStream(new MemoryStream(bytes, writable: false), Format);
        var output = new WasapiOut(
            _device,
            AudioClientShareMode.Shared,
            useEventSync: true,
            latency: 50);
        try
        {
            output.Init(stream);
        }
        catch
        {
            output.Dispose();
            stream.Dispose();
            throw;
        }

        int generation;
        try
        {
            lock (_sync)
            {
                DisposePlayback();
                _stream = stream;
                _output = output;
                generation = ++_generation;
                output.Play();
            }
        }
        catch
        {
            lock (_sync)
            {
                DisposePlayback();
            }
            throw;
        }

        _ = CleanupAfterPlayback(generation, cue.Duration);
    }

    public void Dispose()
    {
        lock (_sync)
        {
            _generation += 1;
            DisposePlayback();
        }
    }

    private async Task CleanupAfterPlayback(int generation, TimeSpan duration)
    {
        await Task.Delay(duration + TimeSpan.FromMilliseconds(200));
        lock (_sync)
        {
            if (generation != _generation)
            {
                return;
            }
            DisposePlayback();
        }
    }

    private void DisposePlayback()
    {
        _output?.Stop();
        _output?.Dispose();
        _stream?.Dispose();
        _output = null;
        _stream = null;
    }
}

internal sealed record SoundCueData(float[] Samples, TimeSpan Duration);

internal static class SoundCueSynthesizer
{
    private const double TwoPi = Math.PI * 2;
    // Drive every cue into the full-scale limiter so Telegram effects are as
    // loud as digital playback allows without emitting out-of-range samples.
    private const double OutputGain = 8;

    public static SoundCueData Create(string name, int sampleRate, int channels)
    {
        return name.ToLowerInvariant() switch
        {
            "chime" => Generate(sampleRate, channels, 0.7, Chime),
            "impact" => GenerateImpact(sampleRate, channels),
            "airhorn" => Generate(sampleRate, channels, 0.9, Airhorn),
            _ => throw new ArgumentException($"Son inconnu: {name}"),
        };
    }

    private static SoundCueData Generate(
        int sampleRate,
        int channels,
        double durationSeconds,
        Func<double, double, double> sampleGenerator)
    {
        var frameCount = (int)(sampleRate * durationSeconds);
        var samples = new float[frameCount * channels];
        for (var frame = 0; frame < frameCount; frame += 1)
        {
            var time = (double)frame / sampleRate;
            var value = (float)Math.Clamp(
                sampleGenerator(time, durationSeconds) * OutputGain,
                -1,
                1);
            for (var channel = 0; channel < channels; channel += 1)
            {
                samples[frame * channels + channel] = value;
            }
        }
        return new SoundCueData(samples, TimeSpan.FromSeconds(durationSeconds));
    }

    private static SoundCueData GenerateImpact(int sampleRate, int channels)
    {
        const double durationSeconds = 0.72;
        var frameCount = (int)(sampleRate * durationSeconds);
        var samples = new float[frameCount * channels];
        var phase = 0d;
        uint noiseState = 0xA341316C;
        for (var frame = 0; frame < frameCount; frame += 1)
        {
            var time = (double)frame / sampleRate;
            var frequency = 115 * Math.Exp(-2.2 * time) + 34;
            phase += TwoPi * frequency / sampleRate;
            noiseState = noiseState * 1_664_525 + 1_013_904_223;
            var noise = ((noiseState >> 8) / 16_777_215d) * 2 - 1;
            var attack = Math.Min(1, time / 0.008);
            var body = Math.Exp(-5.2 * time);
            var value = attack * body * (0.5 * Math.Sin(phase) + 0.12 * noise);
            var sample = (float)Math.Clamp(value * OutputGain, -1, 1);
            for (var channel = 0; channel < channels; channel += 1)
            {
                samples[frame * channels + channel] = sample;
            }
        }
        return new SoundCueData(samples, TimeSpan.FromSeconds(durationSeconds));
    }

    private static double Chime(double time, double duration)
    {
        var first = Bell(time, 523.25);
        var secondTime = time - 0.18;
        var second = secondTime >= 0 ? Bell(secondTime, 783.99) : 0;
        var release = Math.Min(1, (duration - time) / 0.04);
        return 0.3 * release * (first + 0.8 * second);
    }

    private static double Bell(double time, double frequency)
    {
        var attack = Math.Min(1, time / 0.012);
        var decay = Math.Exp(-5.5 * time);
        return attack * decay * (
            Math.Sin(TwoPi * frequency * time) +
            0.35 * Math.Sin(TwoPi * frequency * 2.01 * time));
    }

    private static double Airhorn(double time, double duration)
    {
        var attack = Math.Min(1, time / 0.035);
        var release = Math.Min(1, (duration - time) / 0.12);
        var tremolo = 0.92 + 0.08 * Math.Sin(TwoPi * 5.2 * time);
        var tone =
            Math.Sin(TwoPi * 349.23 * time) +
            0.75 * Math.Sin(TwoPi * 440 * time) +
            0.2 * Math.Sin(TwoPi * 698.46 * time);
        return 0.17 * attack * release * tremolo * tone;
    }
}
