using System.Text.Json;

namespace Teoleevo.Visualizer;

internal static class Protocol
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    private static readonly object OutputLock = new();

    public static void Write(object message)
    {
        var json = JsonSerializer.Serialize(message, Options);
        lock (OutputLock)
        {
            Console.Out.WriteLine(json);
            Console.Out.Flush();
        }
    }

    public static void Error(string message) => Write(new { type = "error", message });
}
