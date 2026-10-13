using NAudio.CoreAudioApi;
using NAudio.CoreAudioApi.Interfaces;
using NAudio.Wave;

namespace Teoleevo.AudioCapture;

/// <summary>
/// WASAPI shared-mode loopback with an event-driven 20 ms buffer. NAudio's
/// standard loopback wrapper uses the same flags but a larger default buffer.
/// </summary>
internal sealed class LowLatencyLoopbackCapture : WasapiCapture
{
    public LowLatencyLoopbackCapture(MMDevice device, int bufferMilliseconds)
        : base(device, useEventSync: true, bufferMilliseconds)
    {
    }

    protected override AudioClientStreamFlags GetAudioClientStreamFlags() =>
        AudioClientStreamFlags.Loopback | base.GetAudioClientStreamFlags();
}
