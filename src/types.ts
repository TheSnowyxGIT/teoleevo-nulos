export type BandName = 'bass' | 'mids' | 'treble';

export type BandValues = Record<BandName, number>;

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface SpectrumFrame {
  timestamp: number;
  db: BandValues;
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
}

export interface Preset {
  id: string;
  name: string;
  path: string;
  relativePath: string;
}

export type VisualizerStatus =
  | {state: 'stopped'; message: string}
  | {state: 'starting'; message: string}
  | {state: 'running'; message: string; preset: Preset}
  | {state: 'error'; message: string}
  | {state: 'unavailable'; message: string};

export interface VisualizerController {
  readonly initialStatus: VisualizerStatus;
  subscribe(listener: (status: VisualizerStatus) => void): () => void;
  selectAudioDevice(deviceId: string): Promise<void>;
  showPreset(preset: Preset): Promise<void>;
  stop(): Promise<void>;
}
