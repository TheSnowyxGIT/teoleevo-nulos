import {execFile, spawn} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {promisify} from 'node:util';
import {isWsl, toLocalPath, toWindowsPath} from '../platform.js';
import type {
  Preset,
  VisualizerController,
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

  constructor(private readonly options: NestDropOptions) {
    this.settings = {...options.settings};
  }

  subscribe(listener: (status: VisualizerStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
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
        await this.openOutputWindow();
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

  private async openOutputWindow(): Promise<void> {
    // FullScreenL is the final trigger that creates the visible DirectX output.
    await this.writeRegistry('FullScreenTitle', 'Teoleevo', 'REG_SZ');
    await this.writeRegistry('FullScreenT', 80);
    await this.writeRegistry('FullScreenH', 720);
    await this.writeRegistry('FullScreenW', 1_280);
    await this.writeRegistry('FullScreenTopMost', 0);
    await this.writeRegistry('FullScreenL', 80);
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
      String(value),
      '/f',
    ], {windowsHide: true});
  }

  private markRunning(): void {
    if (!this.currentPreset) return;
    this.update({
      state: 'running',
      message: `MilkDrop 2 · ${this.deviceName ?? 'sortie Windows par défaut'} · vitesse ${this.settings.speed.toLocaleString('fr-FR')}× · audio ${this.settings.audioGain.toLocaleString('fr-FR')}× · ${this.settings.frameRate} FPS`,
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
