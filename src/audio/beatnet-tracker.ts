import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import path from 'node:path';
import type {RhythmStatus} from '../types.js';

type BeatNetMessage =
  | {type: 'ready'; backend: string; sampleRate: number}
  | {
      type: 'rhythm';
      streamTime: number;
      beat: boolean;
      downbeat: boolean;
      beatPosition?: number | null;
      meter?: number | null;
      bpm?: number | null;
      beatActivation: number;
      downbeatActivation: number;
    }
  | {type: 'error'; message: string};

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function baseStatus(state: RhythmStatus['state'], message: string): RhythmStatus {
  return {
    state,
    message,
    beatActivation: 0,
    downbeatActivation: 0,
    pulse: false,
    downbeat: false,
  };
}

function isBeatNetMessage(value: unknown): value is BeatNetMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

export class BeatNetTracker {
  private child?: ChildProcessWithoutNullStreams;
  private listener?: (status: RhythmStatus) => void;
  private ready = false;
  private streamStartedAt?: number;
  private readonly expectedClosures = new WeakSet<ChildProcessWithoutNullStreams>();
  private readonly pythonPath: string;
  private readonly beatNetRoot: string;
  private readonly workerPath: string;

  constructor(private readonly enabled: boolean) {
    this.pythonPath =
      process.platform === 'win32'
        ? path.join(projectRoot, '.tools', 'beatnet-venv', 'Scripts', 'python.exe')
        : path.join(projectRoot, '.tools', 'beatnet-venv', 'bin', 'python');
    this.beatNetRoot = path.join(projectRoot, '.tools', 'BeatNet');
    this.workerPath = path.join(projectRoot, 'scripts', 'beatnet_worker.py');
  }

  get canReceivePcm(): boolean {
    return this.child !== undefined;
  }

  async start(listener: (status: RhythmStatus) => void): Promise<void> {
    this.listener = listener;
    if (!this.enabled) {
      listener(baseStatus('disabled', 'BeatNet désactivé'));
      return;
    }
    if (
      !existsSync(this.pythonPath) ||
      !existsSync(this.beatNetRoot) ||
      !existsSync(this.workerPath)
    ) {
      listener(
        baseStatus(
          'unavailable',
          'BeatNet absent · lancez pnpm beatnet:install',
        ),
      );
      return;
    }

    listener(baseStatus('starting', 'Chargement du modèle BeatNet…'));
    this.ready = false;
    this.streamStartedAt = undefined;
    const child = spawn(
      this.pythonPath,
      [this.workerPath, '--beatnet-root', this.beatNetRoot, '--model', '1'],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: '1',
          PYTHONUNBUFFERED: '1',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    this.child = child;
    child.stdin.on('error', () => undefined);

    const stderr: string[] = [];
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      stderr.push(String(chunk).trim());
      if (stderr.length > 6) stderr.shift();
    });

    createInterface({input: child.stdout}).on('line', line => {
      try {
        const message: unknown = JSON.parse(line);
        if (isBeatNetMessage(message)) this.handleMessage(message);
      } catch {
        stderr.push(line.slice(0, 200));
      }
    });

    child.on('error', error => {
      if (this.child !== child) return;
      listener(baseStatus('error', `BeatNet: ${error.message}`));
    });
    child.on('close', code => {
      if (this.child !== child) return;
      this.child = undefined;
      this.ready = false;
      if (this.expectedClosures.has(child)) return;
      const detail = stderr.filter(Boolean).at(-1);
      listener(
        baseStatus(
          'error',
          detail || `BeatNet s’est arrêté (code ${code ?? 'inconnu'})`,
        ),
      );
    });
  }

  push(base64Pcm: string): void {
    const child = this.child;
    if (!child || !this.ready || !child.stdin.writable) return;
    if (child.stdin.writableLength > 441 * 4 * 25) return;
    if (this.streamStartedAt === undefined) this.streamStartedAt = Date.now();
    child.stdin.write(Buffer.from(base64Pcm, 'base64'));
  }

  async restart(): Promise<void> {
    const listener = this.listener;
    await this.stopProcess();
    if (listener) await this.start(listener);
  }

  async stop(): Promise<void> {
    await this.stopProcess();
    this.listener?.(baseStatus('disabled', 'BeatNet arrêté'));
  }

  private handleMessage(message: BeatNetMessage): void {
    if (message.type === 'ready') {
      this.ready = true;
      this.listener?.(baseStatus('running', 'BeatNet écoute le flux WASAPI'));
      return;
    }
    if (message.type === 'error') {
      this.listener?.(baseStatus('error', message.message));
      return;
    }

    const latencyMs =
      this.streamStartedAt === undefined
        ? undefined
        : Math.max(0, Date.now() - this.streamStartedAt - message.streamTime * 1_000);
    this.listener?.({
      state: 'running',
      message: message.downbeat
        ? 'Downbeat détecté'
        : message.beat
          ? 'Beat détecté'
          : 'Suivi neuronal actif',
      bpm: message.bpm ?? undefined,
      beatPosition: message.beatPosition ?? undefined,
      meter: message.meter ?? undefined,
      beatActivation: message.beatActivation,
      downbeatActivation: message.downbeatActivation,
      latencyMs,
      pulse: message.beat,
      downbeat: message.downbeat,
    });
  }

  private async stopProcess(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.expectedClosures.add(child);
    this.child = undefined;
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
    if (child.stdin.writable) child.stdin.end();
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
    this.ready = false;
    this.streamStartedAt = undefined;
  }
}
