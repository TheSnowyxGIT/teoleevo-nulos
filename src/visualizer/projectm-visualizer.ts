import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {isWsl, toLocalPath, toWindowsPath} from '../platform.js';
import type {Preset, VisualizerController, VisualizerStatus} from '../types.js';

interface ProjectMOptions {
  rendererPath?: string;
  textureDirectory?: string;
}

interface RendererCommand {
  command: string;
  args: string[];
}

type RendererMessage =
  | {type: 'ready'; deviceId: string; deviceName: string; presetPath: string}
  | {type: 'preset'; path: string}
  | {type: 'device'; deviceId: string; deviceName: string}
  | {type: 'error'; message: string};

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function resolveExistingPath(candidate?: string): string | undefined {
  if (!candidate) return undefined;
  const resolved = path.resolve(toLocalPath(candidate));
  return existsSync(resolved) ? resolved : undefined;
}

export function findProjectMRuntime(): string | undefined {
  return [
    process.env['PROJECTM_RUNTIME_PATH'],
    path.join(projectRoot, '.tools', 'projectm'),
  ]
    .map(resolveExistingPath)
    .find(
      (candidate): candidate is string =>
        Boolean(candidate && existsSync(path.join(candidate, 'projectM-4.dll'))),
    );
}

export function findVisualizerHelper(explicitPath?: string): string | undefined {
  const outputDirectory = path.join(
    projectRoot,
    'native',
    'Visualizer',
    'bin',
    'Release',
    'net7.0-windows',
  );
  const executable = path.join(outputDirectory, 'Visualizer.exe');
  const library = path.join(outputDirectory, 'Visualizer.dll');
  const published = path.join(outputDirectory, 'win-x64', 'publish', 'Visualizer.exe');
  const automaticCandidates = isWsl
    ? [library, published, executable]
    : [published, executable, library];
  return [explicitPath, ...automaticCandidates]
    .map(resolveExistingPath)
    .find((candidate): candidate is string => Boolean(candidate));
}

export function rendererArguments(
  runtimeDirectory: string,
  preset: Preset,
  textureDirectories: string[],
  deviceId?: string,
): string[] {
  const hostPath = (value: string): string =>
    process.platform === 'win32' || isWsl ? toWindowsPath(value) : value;
  const args = [
    '--runtime',
    hostPath(runtimeDirectory),
    '--preset',
    hostPath(preset.path),
    '--width',
    '1280',
    '--height',
    '720',
  ];
  for (const directory of textureDirectories) {
    args.push('--texture', hostPath(directory));
  }
  if (deviceId) args.push('--device-id', deviceId);
  return args;
}

function helperCommand(helperPath: string, args: string[]): RendererCommand {
  if (path.extname(helperPath).toLowerCase() === '.exe') {
    return {command: helperPath, args};
  }

  if (isWsl) {
    const windowsDotnet = '/mnt/c/Program Files/dotnet/dotnet.exe';
    if (existsSync(windowsDotnet)) {
      return {
        command: windowsDotnet,
        args: [path.relative(projectRoot, helperPath), ...args],
      };
    }
  }
  return {command: 'dotnet', args: [helperPath, ...args]};
}

function isRendererMessage(value: unknown): value is RendererMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

export class ProjectMVisualizer implements VisualizerController {
  readonly initialStatus: VisualizerStatus;
  private readonly helper?: string;
  private readonly runtime?: string;
  private readonly listeners = new Set<(status: VisualizerStatus) => void>();
  private child?: ChildProcessWithoutNullStreams;
  private status: VisualizerStatus;
  private currentPreset?: Preset;
  private deviceId?: string;
  private deviceName?: string;

  constructor(private readonly options: ProjectMOptions) {
    this.helper = findVisualizerHelper(options.rendererPath);
    this.runtime = findProjectMRuntime();
    this.status =
      this.helper && this.runtime
        ? {state: 'stopped', message: 'Fenêtre visuelle arrêtée'}
        : {
            state: 'unavailable',
            message: this.unavailableMessage(),
          };
    this.initialStatus = this.status;
  }

  subscribe(listener: (status: VisualizerStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async selectAudioDevice(deviceId: string): Promise<void> {
    if (deviceId === this.deviceId) return;
    this.deviceId = deviceId;
    if (this.child) {
      this.send({type: 'device', deviceId});
    }
  }

  async showPreset(preset: Preset): Promise<void> {
    this.currentPreset = preset;
    if (!this.helper || !this.runtime) {
      this.update({state: 'unavailable', message: this.unavailableMessage()});
      return;
    }

    if (this.child) {
      this.update({state: 'starting', message: `Transition vers ${preset.name}…`});
      this.send({type: 'preset', path: this.hostPath(preset.path), smooth: true});
      return;
    }

    this.update({state: 'starting', message: `Ouverture de ${preset.name}…`});
    const bundledTextures = path.join(this.runtime, 'textures', 'textures');
    const textureDirectories = [
      this.options.textureDirectory,
      existsSync(bundledTextures) ? bundledTextures : undefined,
    ].filter((directory): directory is string => Boolean(directory));
    const command = helperCommand(
      this.helper,
      rendererArguments(this.runtime, preset, textureDirectories, this.deviceId),
    );
    const child = spawn(command.command, command.args, {
      cwd: projectRoot,
      env: {...process.env, DOTNET_NOLOGO: '1'},
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: false,
    });
    this.child = child;
    child.stdin.on('error', () => undefined);

    const diagnostics: string[] = [];
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      const line = String(chunk).trim();
      if (line) diagnostics.push(line);
      if (diagnostics.length > 8) diagnostics.shift();
    });

    const lines = createInterface({input: child.stdout});
    lines.on('line', line => {
      try {
        const message: unknown = JSON.parse(line);
        if (isRendererMessage(message)) this.handleMessage(message);
      } catch {
        diagnostics.push(line);
      }
    });

    child.once('error', error => {
      if (this.child === child) this.child = undefined;
      this.update({state: 'error', message: `Impossible d’ouvrir le rendu: ${error.message}`});
    });
    child.once('close', code => {
      if (this.child !== child) return;
      this.child = undefined;
      if (code === 0) {
        this.update({state: 'stopped', message: 'Fenêtre visuelle arrêtée'});
        return;
      }
      this.update({
        state: 'error',
        message:
          diagnostics.join(' ').slice(-400) ||
          `Le moteur visuel s’est arrêté (code ${code ?? 'inconnu'}).`,
      });
    });
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) {
      if (this.helper && this.runtime) {
        this.update({state: 'stopped', message: 'Fenêtre visuelle arrêtée'});
      }
      return;
    }

    this.child = undefined;
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
    this.sendTo(child, {type: 'quit'});
    child.stdin.end();
    const graceful = await Promise.race([
      closed.then(() => true),
      new Promise<false>(resolve => setTimeout(() => resolve(false), 2_000)),
    ]);
    if (!graceful) {
      child.kill('SIGKILL');
      await Promise.race([
        closed,
        new Promise<void>(resolve => setTimeout(resolve, 1_000)),
      ]);
    }
    this.update({state: 'stopped', message: 'Fenêtre visuelle arrêtée'});
  }

  private handleMessage(message: RendererMessage): void {
    switch (message.type) {
      case 'ready':
        this.deviceId = message.deviceId;
        this.deviceName = message.deviceName;
        this.markRunning();
        break;
      case 'preset':
        this.markRunning();
        break;
      case 'device':
        this.deviceId = message.deviceId;
        this.deviceName = message.deviceName;
        this.markRunning();
        break;
      case 'error':
        this.update({state: 'error', message: message.message});
        break;
    }
  }

  private markRunning(): void {
    if (!this.currentPreset) return;
    this.update({
      state: 'running',
      message: `projectM · ${this.deviceName ?? 'WASAPI'}`,
      preset: this.currentPreset,
    });
  }

  private send(message: object): void {
    if (this.child) this.sendTo(this.child, message);
  }

  private sendTo(child: ChildProcessWithoutNullStreams, message: object): void {
    if (child.stdin.writable) child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private hostPath(value: string): string {
    return process.platform === 'win32' || isWsl ? toWindowsPath(value) : value;
  }

  private update(status: VisualizerStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  private unavailableMessage(): string {
    if (!this.runtime) {
      return `libprojectM absent — lancez pnpm renderer:install${isWsl ? ':wsl' : ''}`;
    }
    return `Hôte visuel absent — lancez pnpm renderer:build${isWsl ? ':wsl' : ''}`;
  }
}
