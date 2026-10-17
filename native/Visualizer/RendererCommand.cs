using System.Text.Json;

namespace Teoleevo.Visualizer;

internal sealed record RendererCommand(
    string Type,
    string? Path,
    string? DeviceId,
    bool Smooth,
    int? FrameRate,
    double? Speed,
    double? AudioGain)
{
    public static RendererCommand Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var type = root.GetProperty("type").GetString()
            ?? throw new JsonException("Commande sans type.");
        var path = root.TryGetProperty("path", out var pathElement)
            ? pathElement.GetString()
            : null;
        var deviceId = root.TryGetProperty("deviceId", out var deviceElement)
            ? deviceElement.GetString()
            : null;
        var smooth = !root.TryGetProperty("smooth", out var smoothElement) || smoothElement.GetBoolean();
        return new RendererCommand(
            type,
            path,
            deviceId,
            smooth,
            ReadInt(root, "frameRate"),
            ReadDouble(root, "speed"),
            ReadDouble(root, "audioGain"));
    }

    private static double? ReadDouble(JsonElement root, string name) =>
        root.TryGetProperty(name, out var element) ? element.GetDouble() : null;

    private static int? ReadInt(JsonElement root, string name) =>
        root.TryGetProperty(name, out var element) ? element.GetInt32() : null;
}
