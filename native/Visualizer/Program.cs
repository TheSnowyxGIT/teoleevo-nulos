using Teoleevo.Visualizer;

try
{
    var options = Options.Parse(args);
    using var window = new RendererWindow(options);
    window.Run();
}
catch (Exception exception)
{
    Protocol.Error(exception.Message);
    Console.Error.WriteLine(exception);
    Environment.ExitCode = 1;
}
