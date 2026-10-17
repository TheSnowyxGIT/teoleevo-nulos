import type {AppOptions, BandValues, SmoothingProfile} from './types.js';

export const DEFAULT_OPTIONS: AppOptions = {
  demo: false,
  fftSize: 2048,
  fps: 30,
  meterFloor: -70,
  beatNet: true,
  autoDropPresets: false,
  visualizerSettings: {
    frameRate: 30,
    speed: 1.07175,
    audioGain: 1,
  },
};

export const BAND_LABELS = {
  bass: {label: 'BASS', range: '20–250 Hz', color: 'magenta'},
  mids: {label: 'MIDS', range: '250 Hz–4 kHz', color: 'cyan'},
  treble: {label: 'TREBLE', range: '4–16 kHz', color: 'yellow'},
} as const;

export const SMOOTHING_PROFILES: Record<
  SmoothingProfile,
  {label: string; attack: number; release: number}
> = {
  fast: {label: 'Rapide', attack: 0.82, release: 0.38},
  balanced: {label: 'Équilibré', attack: 0.62, release: 0.2},
  smooth: {label: 'Fluide', attack: 0.38, release: 0.1},
};

export const EMPTY_BANDS: BandValues = {bass: 0, mids: 0, treble: 0};

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function dbToLevel(db: number, floor: number, ceiling = -6): number {
  return clamp((db - floor) / (ceiling - floor), 0, 1);
}

export function smoothLevel(
  previous: number,
  next: number,
  profile: SmoothingProfile,
): number {
  const settings = SMOOTHING_PROFILES[profile];
  const coefficient = next > previous ? settings.attack : settings.release;
  return previous + (next - previous) * coefficient;
}

export const SMOOTHING_ORDER: SmoothingProfile[] = [
  'fast',
  'balanced',
  'smooth',
];

export const METER_FLOORS = [-80, -70, -60, -50] as const;

export const VISUAL_FRAME_RATES = [10, 15, 20, 24, 30, 45, 60, 90, 120] as const;
export const ANIMATION_SPEEDS = [
  0,
  0.001,
  0.0025,
  0.005,
  0.0075,
  0.01,
  0.025,
  0.05,
  0.075,
  0.1,
  0.25,
  0.5,
  0.75,
  1,
  1.05,
  1.07175,
  1.1,
  1.25,
  1.5,
  2,
] as const;
export const VISUAL_AUDIO_GAINS = [0, 0.1, 0.25, 0.5, 0.75, 1] as const;
