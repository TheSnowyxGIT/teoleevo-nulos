using System.Runtime.InteropServices;

namespace Teoleevo.Visualizer;

internal static class NativeMethods
{
    public const uint SdlInitVideo = 0x00000020;
    public const uint SdlQuit = 0x100;
    public const uint SdlWindowOpenGl = 0x00000002;
    public const uint SdlWindowResizable = 0x00000020;
    public const uint SdlWindowAllowHighDpi = 0x00002000;
    public const int SdlWindowPositionCentered = 0x2FFF0000;
    public const int SdlGlContextMajorVersion = 17;
    public const int SdlGlContextMinorVersion = 18;
    public const int SdlGlContextProfileMask = 21;
    public const int SdlGlContextProfileCore = 1;

    [StructLayout(LayoutKind.Explicit, Size = 56)]
    public struct SdlEvent
    {
        [FieldOffset(0)]
        public uint Type;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetDllDirectory(string path);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int SDL_Init(uint flags);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void SDL_Quit();

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int SDL_GL_SetAttribute(int attribute, int value);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr SDL_CreateWindow(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string title,
        int x,
        int y,
        int width,
        int height,
        uint flags);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void SDL_SetWindowTitle(
        IntPtr window,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string title);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void SDL_DestroyWindow(IntPtr window);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr SDL_GL_CreateContext(IntPtr window);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void SDL_GL_DeleteContext(IntPtr context);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int SDL_GL_MakeCurrent(IntPtr window, IntPtr context);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int SDL_GL_SetSwapInterval(int interval);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void SDL_GL_SwapWindow(IntPtr window);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void SDL_GL_GetDrawableSize(IntPtr window, out int width, out int height);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern int SDL_PollEvent(out SdlEvent sdlEvent);

    [DllImport("SDL2.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr SDL_GetError();

    [DllImport("glew32.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern uint glewInit();

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr projectm_create();

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_destroy(IntPtr instance);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_opengl_render_frame(IntPtr instance);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_set_window_size(
        IntPtr instance,
        UIntPtr width,
        UIntPtr height);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_set_fps(IntPtr instance, int fps);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_set_soft_cut_duration(IntPtr instance, double seconds);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_set_preset_duration(IntPtr instance, double seconds);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_set_preset_locked(
        IntPtr instance,
        [MarshalAs(UnmanagedType.I1)] bool locked);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_set_hard_cut_enabled(
        IntPtr instance,
        [MarshalAs(UnmanagedType.I1)] bool enabled);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_set_texture_search_paths(
        IntPtr instance,
        IntPtr paths,
        UIntPtr count);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_load_preset_file(
        IntPtr instance,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string filename,
        [MarshalAs(UnmanagedType.I1)] bool smoothTransition);

    [DllImport("projectM-4.dll", CallingConvention = CallingConvention.Cdecl)]
    public static extern void projectm_pcm_add_float(
        IntPtr instance,
        [In] float[] samples,
        uint count,
        int channels);

    public static string SdlError()
    {
        var pointer = SDL_GetError();
        return pointer == IntPtr.Zero ? "erreur SDL inconnue" : Marshal.PtrToStringUTF8(pointer) ?? "erreur SDL inconnue";
    }
}
