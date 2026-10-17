import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {isWsl, toLocalPath} from '../platform.js';
import type {
  AudioDevice,
  CaptureEvents,
  CaptureInfo,
  CaptureSource,
  SpectrumFrame,
} from '../types.js';

interface WindowsCaptureOptions {
  deviceId?: string;
  fftSize: number;
  fps: number;
  helperPath?: string;
}

type HelperMessage =
  | {type: 'devices'; devices: AudioDevice[]}
  | ({type: 'ready'} & CaptureInfo)
  | {
      type: 'frame';
      timestamp: number;
      db: SpectrumFrame['db'];
      hasSignal: boolean;
    }
  | {type: 'error'; message: string};

interface HelperCommand {
  command: string;
  args: string[];
}

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
function helperCommand(
  options: WindowsCaptureOptions,
  helperArguments: string[],
): HelperCommand {
  if (options.helperPath) {
    const explicitPath = path.resolve(toLocalPath(options.helperPath));
    if (!existsSync(explicitPath)) {
      throw new Error(`Helper audio introuvable: ${explicitPath}`);
    }
    return {command: explicitPath, args: helperArguments};
  }

  if (isWsl) {
    const windowsDotnet = '/mnt/c/Program Files/dotnet/dotnet.exe';
    const helperDll = path.join(
      projectRoot,
      'native',
      'AudioCapture',
      'bin',
      'Release',
      'net7.0-windows',
      'AudioCapture.dll',
    );
    if (existsSync(windowsDotnet) && existsSync(helperDll)) {
      // Windows processes launched by WSL inherit the workspace as their UNC
      // working directory, so a relative path works in both environments.
      return {
        command: windowsDotnet,
        args: [path.relative(projectRoot, helperDll), ...helperArguments],
      };
    }
  }

  const candidates = [
    path.join(projectRoot, 'native', 'AudioCapture', 'bin', 'Release', 'net7.0-windows', 'win-x64', 'publish', 'AudioCapture.exe'),
    path.join(projectRoot, 'native', 'AudioCapture', 'bin', 'Release', 'net7.0-windows', 'AudioCapture.exe'),
  ];
  const executable = candidates.find(candidate => existsSync(candidate));
  if (executable) {
    return {command: executable, args: helperArguments};
  }

  const project = path.join(
    projectRoot,
    'native',
    'AudioCapture',
    'AudioCapture.csproj',
  );
  if (!existsSync(project)) {
    throw new Error(
      'Helper WASAPI absent. Réinstallez le projet ou utilisez --helper <chemin>.',
    );
  }

  return {
    command: 'dotnet',
    args: [
      'run',
      '--project',
      project,
      '--configuration',
      'Release',
      '--',
      ...helperArguments,
    ],
  };
}

function isHelperMessage(value: unknown): value is HelperMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

export class WindowsCapture implements CaptureSource {
  readonly kind = 'wasapi' as const;
  private child?: ChildProcessWithoutNullStreams;
  private events?: CaptureEvents;
  private active = false;
  private changingDevice = false;
  private deviceId?: string;

  constructor(private readonly options: WindowsCaptureOptions) {
    this.deviceId = options.deviceId;
  }

  async start(events: CaptureEvents): Promise<void> {
    if (process.platform !== 'win32' && !isWsl) {
      throw new Error(
        'La capture WASAPI nécessite Windows ou WSL avec l’interop Windows. Utilisez --demo ici.',
      );
    }

    this.events = events;
    this.active = true;
    await this.launch();
  }

  async selectDevice(deviceId: string): Promise<void> {
    if (!this.active || deviceId === this.deviceId) return;
    this.changingDevice = true;
    this.deviceId = deviceId;
    this.events?.onStatus({state: 'starting', message: 'Changement de sortie audio…'});
    await this.stopProcess();
    this.changingDevice = false;
    await this.launch();
  }

  async stop(): Promise<void> {
    this.active = false;
    await this.stopProcess();
    this.events?.onStatus({state: 'stopped', message: 'Capture arrêtée'});
  }

  private async launch(): Promise<void> {
    const events = this.events;
    if (!events) return;

    events.onStatus({state: 'starting', message: 'Connexion à WASAPI…'});

    const helperArguments = [
      '--fft-size',
      String(this.options.fftSize),
      '--fps',
      String(this.options.fps),
    ];
    if (this.deviceId) helperArguments.push('--device-id', this.deviceId);

    let command: HelperCommand;
    try {
      command = helperCommand(this.options, helperArguments);
    } catch (error) {
      events.onStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const child = spawn(command.command, command.args, {
      cwd: projectRoot,
      env: {...process.env, DOTNET_NOLOGO: '1'},
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;
    // A helper may exit between the UI requesting shutdown and this process
    // writing "quit". An EPIPE during that race is expected and harmless.
    child.stdin.on('error', () => undefined);

    const stderr: string[] = [];
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      stderr.push(String(chunk).trim());
      if (stderr.length > 4) stderr.shift();
    });

    child.on('error', error => {
      if (this.child !== child) return;
      events.onStatus({
        state: 'error',
        message:
          error.message.includes('ENOENT') && command.command === 'dotnet'
            ? 'Le SDK .NET 7+ est requis. Lancez pnpm helper:build depuis Windows.'
            : `Impossible de démarrer la capture: ${error.message}`,
      });
    });

    const lines = createInterface({input: child.stdout});
    lines.on('line', line => {
      try {
        const message: unknown = JSON.parse(line);
        if (isHelperMessage(message)) this.handleMessage(message);
      } catch {
        events.onStatus({
          state: 'error',
          message: `Réponse invalide du helper audio: ${line.slice(0, 100)}`,
        });
      }
    });

    child.on('close', code => {
      if (this.child === child) this.child = undefined;
      if (!this.active || this.changingDevice) return;
      const details = stderr.filter(Boolean).join(' ');
      events.onStatus({
        state: 'error',
        message: details || `Le helper audio s’est arrêté (code ${code ?? 'inconnu'}).`,
      });
    });
  }

  private handleMessage(message: HelperMessage): void {
    switch (message.type) {
      case 'devices':
        this.events?.onDevices(message.devices);
        break;
      case 'ready':
        this.deviceId = message.deviceId;
        this.events?.onInfo({
          deviceId: message.deviceId,
          deviceName: message.deviceName,
          sampleRate: message.sampleRate,
          channels: message.channels,
          fftSize: message.fftSize,
        });
        this.events?.onStatus({state: 'running', message: 'Capture WASAPI active'});
        break;
      case 'frame':
        this.events?.onFrame({
          timestamp: message.timestamp,
          db: message.db,
          hasSignal: message.hasSignal,
        });
        break;
      case 'error':
        this.events?.onStatus({state: 'error', message: message.message});
        break;
    }
  }

  private async stopProcess(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.child = undefined;

    const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
    if (child.stdin.writable) {
      child.stdin.end('quit\n');
    }
    const graceful = await Promise.race([
      closed.then(() => true),
      new Promise<false>(resolve => setTimeout(() => resolve(false), 1_000)),
    ]);
    if (!graceful && !child.killed) {
      child.kill();
      await Promise.race([
        closed,
        new Promise<void>(resolve => setTimeout(resolve, 1_000)),
      ]);
    }
  }
}
