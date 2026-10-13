import type {AppOptions, BandValues, SmoothingProfile} from './types.js';

export const DEFAULT_OPTIONS: AppOptions = {
  demo: false,
  fftSize: 2048,
  fps: 30,
  meterFloor: -70,
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
