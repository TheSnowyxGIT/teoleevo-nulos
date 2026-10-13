param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$release = '2.0.0-pre1'
$archiveName = 'projectMSDL-2.0.0-win64.zip'
$downloadUrl = "https://github.com/projectM-visualizer/frontend-sdl-cpp/releases/download/$release/$archiveName"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$toolsDirectory = Join-Path $repositoryRoot '.tools'
$destination = Join-Path $toolsDirectory 'projectm'
$runtimeLibrary = Join-Path $destination 'projectM-4.dll'

if ((Test-Path $runtimeLibrary) -and -not $Force) {
    Write-Host "libprojectM is already installed: $runtimeLibrary"
    exit 0
}

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("teoleevo-projectm-" + [Guid]::NewGuid())
$archive = Join-Path $temporaryRoot $archiveName

try {
    New-Item -ItemType Directory -Force -Path $temporaryRoot, $toolsDirectory | Out-Null
    Write-Host "Downloading projectMSDL $release..."
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archive
    Write-Host 'Extracting the renderer, libraries and textures...'
    if (Test-Path $destination) {
        Remove-Item -LiteralPath $destination -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $destination | Out-Null

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $prefix = 'projectMSDL-2.0.0-win64/'
        $destinationPrefix = [System.IO.Path]::GetFullPath($destination) + [IO.Path]::DirectorySeparatorChar
        foreach ($entry in $zip.Entries) {
            if (-not $entry.FullName.StartsWith($prefix)) {
                continue
            }

            $relative = $entry.FullName.Substring($prefix.Length)
            $isRootRuntime = $relative -match '^[^/]+\.dll$'
            $isTexture = $relative.StartsWith('textures/')
            if (-not $isRootRuntime -and -not $isTexture) {
                continue
            }

            $target = [System.IO.Path]::GetFullPath(
                (Join-Path $destination ($relative.Replace('/', [IO.Path]::DirectorySeparatorChar)))
            )
            if (-not $target.StartsWith($destinationPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Unsafe path in projectMSDL archive: $relative"
            }
            if ([string]::IsNullOrEmpty($entry.Name)) {
                New-Item -ItemType Directory -Force -Path $target | Out-Null
                continue
            }

            $parent = Split-Path -Parent $target
            New-Item -ItemType Directory -Force -Path $parent | Out-Null
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
        }
    }
    finally {
        $zip.Dispose()
    }

    if (-not (Test-Path $runtimeLibrary)) {
        throw 'Unexpected projectMSDL archive: libprojectM not found.'
    }
    Write-Host "libprojectM installed: $runtimeLibrary"
}
finally {
    if (Test-Path $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
