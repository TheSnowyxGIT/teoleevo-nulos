export type BandName = 'bass' | 'mids' | 'treble';

export type BandValues = Record<BandName, number>;

export interface AudioFeatures {
  loudnessDb: number;
  subBassDb: number;
  lowMidDb: number;
  highMidDb: number;
  spectralCentroid: number;
  spectralFlux: number;
}

export type RhythmStatus = {
  state: 'disabled' | 'unavailable' | 'starting' | 'running' | 'error';
  message: string;
  bpm?: number;
  beatPosition?: number;
  meter?: number;
  beatActivation: number;
  downbeatActivation: number;
  latencyMs?: number;
  pulse: boolean;
  downbeat: boolean;
};

export type MusicEventState =
  | 'waiting'
  | 'learning'
  | 'neutral'
  | 'build-up'
  | 'drop'
  | 'breakdown';

export interface MusicEventAnalysis {
  state: MusicEventState;
  message: string;
  confidence: number;
  dropTriggered: boolean;
  dropTimestamp?: number;
  barsObserved: number;
  metrics: {
    drop: number;
    impact: number;
    bassReturn: number;
    buildUp: number;
    novelty: number;
  };
}

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface SpectrumFrame {
  timestamp: number;
  db: BandValues;
  features: AudioFeatures;
  hasSignal: boolean;
}

export interface CaptureInfo {
  deviceId: string;
  deviceName: string;
  sampleRate: number;
  channels: number;
  fftSize: number;
}

export type CaptureStatus =
  | {state: 'starting'; message: string}
  | {state: 'running'; message: string}
  | {state: 'error'; message: string}
  | {state: 'stopped'; message: string};

export interface CaptureEvents {
  onDevices(devices: AudioDevice[]): void;
  onFrame(frame: SpectrumFrame): void;
  onRhythm(status: RhythmStatus): void;
  onInfo(info: CaptureInfo): void;
  onStatus(status: CaptureStatus): void;
}

export interface CaptureSource {
  readonly kind: 'demo' | 'wasapi';
  start(events: CaptureEvents): Promise<void>;
  selectDevice(deviceId: string): Promise<void>;
  stop(): Promise<void>;
}

export type SmoothingProfile = 'fast' | 'balanced' | 'smooth';

export interface VisualizerSettings {
  frameRate: number;
  speed: number;
  audioGain: number;
}

export interface VisualizerDisplay {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface AppOptions {
  demo: boolean;
  deviceId?: string;
  fftSize: 1024 | 2048 | 4096;
  fps: number;
  meterFloor: number;
  helperPath?: string;
  presetDirectory?: string;
  textureDirectory?: string;
  rendererPath?: string;
  nestDropRendererPath?: string;
  beatNet: boolean;
  autoDropPresets: boolean;
  visualizerSettings: VisualizerSettings;
}

export interface Preset {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  tags: PresetTag[];
}

export type PresetTag = 'build-up' | 'drop' | 'verse' | 'other';

export type VisualizerStatus =
  | {state: 'stopped'; message: string}
  | {state: 'starting'; message: string}
  | {state: 'running'; message: string; preset: Preset}
  | {state: 'error'; message: string}
  | {state: 'unavailable'; message: string};

export interface VisualizerController {
  readonly initialStatus: VisualizerStatus;
  subscribe(listener: (status: VisualizerStatus) => void): () => void;
  listDisplays(): Promise<VisualizerDisplay[]>;
  setFullscreen(enabled: boolean, display?: VisualizerDisplay): Promise<void>;
  selectAudioDevice(deviceId: string, deviceName?: string): Promise<void>;
  configure(settings: VisualizerSettings): Promise<void>;
  showPreset(preset: Preset): Promise<void>;
  stop(): Promise<void>;
}
