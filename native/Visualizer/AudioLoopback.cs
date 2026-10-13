using System.Collections.Concurrent;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using Teoleevo.AudioCapture;

namespace Teoleevo.Visualizer;

internal sealed class AudioLoopback : IDisposable
{
    private readonly ConcurrentQueue<float[]> _buffers = new();
    private MMDeviceEnumerator? _enumerator;
    private MMDevice? _device;
    private LowLatencyLoopbackCapture? _recorder;

    public string DeviceId => _device?.ID ?? string.Empty;
    public string DeviceName => _device?.FriendlyName ?? string.Empty;

    public void SelectDevice(string? deviceId)
    {
        Stop();
        _enumerator = new MMDeviceEnumerator();
        _device = string.IsNullOrWhiteSpace(deviceId)
            ? _enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia)
            : _enumerator.GetDevice(deviceId);

        var format = WaveFormat.CreateIeeeFloatWaveFormat(48_000, 2);
        _recorder = new LowLatencyLoopbackCapture(_device, 20)
        {
            WaveFormat = format,
        };
        _recorder.DataAvailable += OnDataAvailable;
        _recorder.RecordingStopped += OnRecordingStopped;
        _recorder.StartRecording();
    }

    public void Feed(ProjectMEngine engine)
    {
        while (_buffers.TryDequeue(out var samples))
        {
            engine.AddAudio(samples);
        }
    }

    public void Dispose() => Stop();

    private void OnDataAvailable(object? sender, WaveInEventArgs eventArgs)
    {
        var samples = new float[eventArgs.BytesRecorded / sizeof(float)];
        Buffer.BlockCopy(eventArgs.Buffer, 0, samples, 0, eventArgs.BytesRecorded);
        _buffers.Enqueue(samples);
        while (_buffers.Count > 8)
        {
            _buffers.TryDequeue(out _);
        }
    }

    private static void OnRecordingStopped(object? sender, StoppedEventArgs eventArgs)
    {
        if (eventArgs.Exception is not null)
        {
            Protocol.Error($"Capture WASAPI interrompue: {eventArgs.Exception.Message}");
        }
    }

    private void Stop()
    {
        if (_recorder is not null)
        {
            _recorder.DataAvailable -= OnDataAvailable;
            _recorder.RecordingStopped -= OnRecordingStopped;
            _recorder.StopRecording();
            _recorder.Dispose();
            _recorder = null;
        }
        _device?.Dispose();
        _device = null;
        _enumerator?.Dispose();
        _enumerator = null;
        while (_buffers.TryDequeue(out _))
        {
        }
    }
}
