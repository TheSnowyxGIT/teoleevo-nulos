import {execFile, spawn} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {promisify} from 'node:util';
import {isWsl, toLocalPath, toWindowsPath} from '../platform.js';
import type {
  Preset,
  VisualizerController,
  VisualizerDisplay,
  VisualizerSettings,
  VisualizerStatus,
} from '../types.js';

const execFileAsync = promisify(execFile);
const registryKey = String.raw`HKCU\SOFTWARE\NI\BDN\Deck1`;
const hiddenWindowPosition = 0xffffffff;

interface NestDropOptions {
  rendererPath: string;
  settings: VisualizerSettings;
}

export function findNestDropRenderer(
  presetDirectory?: string,
  explicitPath = process.env['NESTDROP_RENDERER_PATH'],
): string | undefined {
  if (explicitPath) {
    const candidate = path.resolve(toLocalPath(explicitPath));
    const spoutCandidate = path.join(path.dirname(candidate), 'NestDrop_SpoutSender.exe');
    if (existsSync(spoutCandidate)) return spoutCandidate;
    if (path.basename(candidate).toLowerCase() === 'nestdrop_spoutsender.exe' && existsSync(candidate)) {
      return candidate;
    }
  }

  if (!presetDirectory) return undefined;
  let current = path.resolve(toLocalPath(presetDirectory));
  while (true) {
    for (const candidate of [
      path.join(current, 'NestDrop_SpoutSender.exe'),
      path.join(current, 'Plugins', 'NestDrop_SpoutSender.exe'),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function nestDropRegistryValues(settings: VisualizerSettings): Record<string, number> {
  const audio = Math.round(Math.min(1, Math.max(0, settings.audioGain)) * 1_000);
  return {
    TargetFPS: settings.frameRate,
    AnimationSpeed: Math.round(settings.speed * 1_000),
    Channel: 3,
    Bass: audio,
    Mid: audio,
    Treble: audio,
  };
}

export function nestDropOutputValues(
  display: Pick<VisualizerDisplay, 'width' | 'height'>,
): Record<string, number> {
  return {
    SpoutWidth: Math.max(1, Math.round(display.width)),
    SpoutHeight: Math.max(1, Math.round(display.height)),
  };
}

export class NestDropVisualizer implements VisualizerController {
  readonly initialStatus: VisualizerStatus = {
    state: 'stopped',
    message: 'Fenêtre MilkDrop 2 arrêtée',
  };
  private readonly listeners = new Set<(status: VisualizerStatus) => void>();
  private status = this.initialStatus;
  private child?: ChildProcess;
  private currentPreset?: Preset;
  private deviceId?: string;
  private deviceName?: string;
  private settings: VisualizerSettings;
  private presetId = Date.now() & 0x7fffffff;
  private fullscreenEnabled = false;
  private fullscreenDisplay?: VisualizerDisplay;

  constructor(private readonly options: NestDropOptions) {
    this.settings = {...options.settings};
  }

  subscribe(listener: (status: VisualizerStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  async listDisplays(): Promise<VisualizerDisplay[]> {
    const powershell = isWsl
      ? '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
      : 'powershell.exe';
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '@([System.Windows.Forms.Screen]::AllScreens | ForEach-Object {',
      "[PSCustomObject]@{ id=$_.DeviceName; name=($_.DeviceName -replace '^\\\\\\.\\\\',''); x=$_.Bounds.X; y=$_.Bounds.Y; width=$_.Bounds.Width; height=$_.Bounds.Height; isPrimary=$_.Primary }",
      '}) | ConvertTo-Json -Compress',
    ].join('; ');
    try {
      const {stdout} = await execFileAsync(
        powershell,
        ['-NoProfile', '-Command', script],
        {encoding: 'utf8', windowsHide: true},
      );
      const text = String(stdout).trim();
      if (!text) return [];
      const parsed: unknown = JSON.parse(text);
      const values = Array.isArray(parsed) ? parsed : [parsed];
      return values
        .filter(isVisualizerDisplay)
        .map(display => ({
          ...display,
          name: display.id.replace(/^\\\\\.\\/, ''),
        }))
        .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
    } catch {
      return [];
    }
  }

  async setFullscreen(
    enabled: boolean,
    display?: VisualizerDisplay,
  ): Promise<void> {
    const previousDisplay = this.fullscreenDisplay;
    this.fullscreenEnabled = enabled;
    if (display) this.fullscreenDisplay = display;
    if (!this.child) return;

    if (
      display &&
      (!previousDisplay ||
        display.width !== previousDisplay.width ||
        display.height !== previousDisplay.height) &&
      this.currentPreset
    ) {
      const preset = this.currentPreset;
      await this.stopRenderer();
      await this.launch(preset);
      return;
    }

    if (!enabled) {
      await this.writeRegistry('FullScreenL', hiddenWindowPosition);
    } else {
      const target = this.fullscreenDisplay ?? (await this.listDisplays())[0];
      if (!target) {
        throw new Error('Aucun écran Windows disponible pour le plein écran.');
      }
      this.fullscreenDisplay = target;
      await this.openOutputWindow(target);
    }
    this.markRunning();
  }

  async selectAudioDevice(deviceId: string, deviceName?: string): Promise<void> {
    if (deviceId === this.deviceId && deviceName === this.deviceName) return;
    const wasRunning = Boolean(this.child);
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    if (wasRunning && this.currentPreset) {
      const preset = this.currentPreset;
      await this.stopRenderer();
      await this.launch(preset);
    }
  }

  async configure(settings: VisualizerSettings): Promise<void> {
    this.settings = {...settings};
    if (!this.child) return;
    await this.writeSettings();
    this.markRunning();
  }

  async showPreset(preset: Preset): Promise<void> {
    this.currentPreset = preset;
    if (!this.child) {
      await this.launch(preset);
      return;
    }

    this.update({state: 'starting', message: `Transition vers ${preset.name}…`});
    await this.writeRegistry('presetFileName', this.hostPath(preset.path), 'REG_SZ');
    this.presetId = (this.presetId + 1) & 0x7fffffff;
    await this.writeRegistry('presetId', this.presetId);
    this.markRunning();
  }

  async stop(): Promise<void> {
    await this.stopRenderer();
    this.update({state: 'stopped', message: 'Fenêtre MilkDrop 2 arrêtée'});
  }

  private async launch(preset: Preset): Promise<void> {
    this.update({state: 'starting', message: `Ouverture MilkDrop 2 · ${preset.name}…`});
    try {
      const outputDisplay = this.fullscreenDisplay ?? (await this.listDisplays())[0];
      if (outputDisplay) {
        this.fullscreenDisplay = outputDisplay;
        await this.writeOutputResolution(outputDisplay);
      }
      await this.writeSettings();
      await this.writeRegistry('TransitionDelay', 1_500);
      await this.writeRegistry('QuitRequest', 0);
      await this.writeRegistry('FullScreenL', hiddenWindowPosition);
      await this.writeRegistry('presetFileName', this.hostPath(preset.path), 'REG_SZ');
      this.presetId = (this.presetId + 1) & 0x7fffffff;
      await this.writeRegistry('presetId', this.presetId);

      const args = this.deviceName ? ['--device', this.deviceName] : [];
      const child = spawn(
        this.options.rendererPath,
        args,
        {
          cwd: path.dirname(path.dirname(this.options.rendererPath)),
          stdio: 'ignore',
          windowsHide: false,
        },
      );
      this.child = child;
      child.once('error', error => {
        if (this.child !== child) return;
        this.child = undefined;
        this.update({
          state: 'error',
          message: `Impossible de démarrer MilkDrop 2: ${error.message}`,
        });
      });
      child.once('close', code => {
        if (this.child !== child) return;
        this.child = undefined;
        this.update({
          state: code === 0 ? 'stopped' : 'error',
          message:
            code === 0
              ? 'Fenêtre MilkDrop 2 arrêtée'
              : `MilkDrop 2 s’est arrêté (code ${code ?? 'inconnu'}).`,
        });
      });
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.child === child) {
        if (this.fullscreenEnabled) {
          const target = this.fullscreenDisplay ?? (await this.listDisplays())[0];
          if (target) {
            this.fullscreenDisplay = target;
            await this.openOutputWindow(target);
          }
        }
        this.markRunning();
      }
    } catch (error) {
      this.update({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async stopRenderer(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.child = undefined;
    await this.writeRegistry('FullScreenL', hiddenWindowPosition).catch(() => undefined);
    await this.writeRegistry('QuitRequest', 1).catch(() => undefined);
    if (child.exitCode === null) {
      const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
      const graceful = await Promise.race([
        closed.then(() => true),
        new Promise<false>(resolve => setTimeout(() => resolve(false), 2_000)),
      ]);
      if (!graceful && child.exitCode === null) child.kill();
    }
  }

  private async writeSettings(): Promise<void> {
    const values = nestDropRegistryValues(this.settings);
    await Promise.all(
      Object.entries(values).map(([name, value]) => this.writeRegistry(name, value)),
    );
  }

  private async writeOutputResolution(display: VisualizerDisplay): Promise<void> {
    await Promise.all(
      Object.entries(nestDropOutputValues(display)).map(([name, value]) =>
        this.writeRegistry(name, value),
      ),
    );
  }

  private async openOutputWindow(display: VisualizerDisplay): Promise<void> {
    // FullScreenL is the final trigger that creates the visible DirectX output.
    await this.writeRegistry('FullScreenL', hiddenWindowPosition);
    await new Promise(resolve => setTimeout(resolve, 120));
    await this.writeRegistry('FullScreenTitle', `Teoleevo - ${display.name}`, 'REG_SZ');
    await this.writeRegistry('FullScreenT', display.y);
    await this.writeRegistry('FullScreenH', display.height);
    await this.writeRegistry('FullScreenW', display.width);
    await this.writeRegistry('FullScreenTopMost', 0);
    await this.writeRegistry('FullScreenL', display.x);
  }

  private async writeRegistry(
    name: string,
    value: number | string,
    type: 'REG_DWORD' | 'REG_SZ' = 'REG_DWORD',
  ): Promise<void> {
    const command = isWsl ? '/mnt/c/Windows/System32/reg.exe' : 'reg.exe';
    await execFileAsync(command, [
      'add',
      registryKey,
      '/v',
      name,
      '/t',
      type,
      '/d',
      String(
        type === 'REG_DWORD' && typeof value === 'number' && value < 0
          ? value >>> 0
          : value,
      ),
      '/f',
    ], {windowsHide: true});
  }

  private markRunning(): void {
    if (!this.currentPreset) return;
    const resolution = this.fullscreenDisplay
      ? `rendu ${this.fullscreenDisplay.width}×${this.fullscreenDisplay.height}`
      : 'résolution NestDrop';
    this.update({
      state: 'running',
      message: `MilkDrop 2 · ${resolution} · ${this.fullscreenEnabled ? `plein écran ${this.fullscreenDisplay?.name ?? ''}` : 'sortie masquée'} · ${this.deviceName ?? 'sortie Windows par défaut'} · ${this.settings.frameRate} FPS`,
      preset: this.currentPreset,
    });
  }

  private hostPath(value: string): string {
    return process.platform === 'win32' || isWsl ? toWindowsPath(value) : value;
  }

  private update(status: VisualizerStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

function isVisualizerDisplay(value: unknown): value is VisualizerDisplay {
  if (typeof value !== 'object' || value === null) return false;
  const display = value as Partial<VisualizerDisplay>;
  return (
    typeof display.id === 'string' &&
    typeof display.name === 'string' &&
    typeof display.x === 'number' &&
    typeof display.y === 'number' &&
    typeof display.width === 'number' &&
    typeof display.height === 'number' &&
    typeof display.isPrimary === 'boolean'
  );
}
