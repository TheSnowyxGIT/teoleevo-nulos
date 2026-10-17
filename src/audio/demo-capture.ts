import type {
  AudioFeatures,
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
  private lastBeat = -1;

  constructor(
    private readonly fps: number,
    private readonly fftSize: number,
  ) {}

  async start(events: CaptureEvents): Promise<void> {
    this.startedAt = performance.now();
    this.lastBeat = -1;
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
    this.timer = setInterval(() => {
      const frame = this.createFrame();
      events.onFrame(frame);
      const seconds = (performance.now() - this.startedAt) / 1_000;
      const beatIndex = Math.floor(seconds * 2.15);
      const pulse = beatIndex !== this.lastBeat;
      this.lastBeat = beatIndex;
      const beatPosition = (beatIndex % 4) + 1;
      events.onRhythm({
        state: 'running',
        message: pulse
          ? beatPosition === 1
            ? 'Downbeat simulé'
            : 'Beat simulé'
          : 'BeatNet simulé',
        bpm: 129,
        beatPosition,
        meter: 4,
        beatActivation: pulse ? 0.9 : 0.08,
        downbeatActivation: pulse && beatPosition === 1 ? 0.92 : 0.04,
        pulse,
        downbeat: pulse && beatPosition === 1,
      });
    }, interval);
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

    const timestamp = Date.now();
    const db = {
      bass: -46 + beat * 39 + Math.sin(seconds * 2.2) * 2,
      mids: -34 + phrase * 19 + Math.sin(seconds * 4.4) * 3,
      treble: -50 + shimmer * 34 + beat * 6,
    };
    const features: AudioFeatures = {
      loudnessDb: -42 + beat * 25 + phrase * 8,
      subBassDb: db.bass - 2,
      lowMidDb: db.mids - 1,
      highMidDb: db.treble + 3,
      spectralCentroid: 900 + shimmer * 2_800 + beat * 500,
      spectralFlux: 0.025 + beat * 0.4,
    };

    return {
      timestamp,
      hasSignal: true,
      db,
      features,
    };
  }
}
