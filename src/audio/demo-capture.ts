import type {
  AudioDevice,
  CaptureEvents,
  CaptureSource,
  SpectrumFrame,
} from '../types.js';

const DEMO_DEVICE: AudioDevice = {
  id: 'demo',
  name: 'Signal musical simulé',
  isDefault: true,
};

export class DemoCapture implements CaptureSource {
  readonly kind = 'demo' as const;
  private timer?: NodeJS.Timeout;
  private startedAt = 0;

  constructor(
    private readonly fps: number,
    private readonly fftSize: number,
  ) {}

  async start(events: CaptureEvents): Promise<void> {
    this.startedAt = performance.now();
    events.onDevices([DEMO_DEVICE]);
    events.onInfo({
      deviceId: DEMO_DEVICE.id,
      deviceName: DEMO_DEVICE.name,
      sampleRate: 48_000,
      channels: 2,
      fftSize: this.fftSize,
    });
    events.onStatus({state: 'running', message: 'Mode démo actif'});

    const interval = Math.round(1000 / this.fps);
    this.timer = setInterval(() => events.onFrame(this.createFrame()), interval);
  }

  async selectDevice(_deviceId: string): Promise<void> {}

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private createFrame(): SpectrumFrame {
    const seconds = (performance.now() - this.startedAt) / 1000;
    const beatPhase = seconds * 2.15;
    const beat = Math.exp(-8 * (beatPhase - Math.floor(beatPhase)));
    const phrase = (Math.sin(seconds * 0.72) + 1) / 2;
    const shimmer = (Math.sin(seconds * 13.7) + Math.sin(seconds * 7.1) + 2) / 4;

    return {
      timestamp: Date.now(),
      hasSignal: true,
      db: {
        bass: -46 + beat * 39 + Math.sin(seconds * 2.2) * 2,
        mids: -34 + phrase * 19 + Math.sin(seconds * 4.4) * 3,
        treble: -50 + shimmer * 34 + beat * 6,
      },
    };
  }
}
