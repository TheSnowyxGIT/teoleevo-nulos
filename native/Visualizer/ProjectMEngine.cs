using System.Runtime.InteropServices;

namespace Teoleevo.Visualizer;

internal sealed class ProjectMEngine : IDisposable
{
    private IntPtr _handle;

    public ProjectMEngine(IReadOnlyList<string> textureDirectories, int width, int height)
    {
        _handle = NativeMethods.projectm_create();
        if (_handle == IntPtr.Zero)
        {
            throw new InvalidOperationException(
                "libprojectM n’a pas pu démarrer. Le contexte OpenGL 3.3 est peut-être indisponible.");
        }

        NativeMethods.projectm_set_window_size(_handle, (UIntPtr)(uint)width, (UIntPtr)(uint)height);
        NativeMethods.projectm_set_fps(_handle, 60);
        NativeMethods.projectm_set_soft_cut_duration(_handle, 1.5);
        NativeMethods.projectm_set_preset_duration(_handle, 86_400);
        NativeMethods.projectm_set_preset_locked(_handle, true);
        NativeMethods.projectm_set_hard_cut_enabled(_handle, false);
        SetTextureDirectories(textureDirectories);
    }

    public void Resize(int width, int height) =>
        NativeMethods.projectm_set_window_size(_handle, (UIntPtr)(uint)width, (UIntPtr)(uint)height);

    public void LoadPreset(string path, bool smoothTransition)
    {
        var absolutePath = Path.GetFullPath(path);
        if (!File.Exists(absolutePath))
        {
            throw new FileNotFoundException("Preset introuvable.", absolutePath);
        }
        NativeMethods.projectm_load_preset_file(_handle, absolutePath, smoothTransition);
    }

    public void AddAudio(float[] samples)
    {
        const int channels = 2;
        NativeMethods.projectm_pcm_add_float(_handle, samples, (uint)(samples.Length / channels), channels);
    }

    public void Render() => NativeMethods.projectm_opengl_render_frame(_handle);

    public void Dispose()
    {
        if (_handle == IntPtr.Zero)
        {
            return;
        }
        NativeMethods.projectm_destroy(_handle);
        _handle = IntPtr.Zero;
    }

    private void SetTextureDirectories(IReadOnlyList<string> directories)
    {
        if (directories.Count == 0)
        {
            return;
        }

        var strings = directories.Select(Marshal.StringToCoTaskMemUTF8).ToArray();
        var array = Marshal.AllocHGlobal(IntPtr.Size * strings.Length);
        try
        {
            Marshal.Copy(strings, 0, array, strings.Length);
            NativeMethods.projectm_set_texture_search_paths(_handle, array, (UIntPtr)(uint)strings.Length);
        }
        finally
        {
            Marshal.FreeHGlobal(array);
            foreach (var pointer in strings)
            {
                Marshal.FreeCoTaskMem(pointer);
            }
        }
    }
}
