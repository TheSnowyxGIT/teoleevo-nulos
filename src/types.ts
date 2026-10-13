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
}
