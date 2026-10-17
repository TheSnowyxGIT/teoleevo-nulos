import type {Preset} from '../types.js';

export interface PresetQueue {
  current?: Preset;
  priority?: Preset;
  upcoming: Preset[];
}

export function buildPresetQueue(
  playlistPresets: Preset[],
  selectedPreset?: Preset,
  visibleUpcoming = 4,
): PresetQueue {
  if (!selectedPreset) {
    return {upcoming: playlistPresets.slice(0, visibleUpcoming)};
  }

  const currentIndex = playlistPresets.findIndex(preset => preset.id === selectedPreset.id);
  if (currentIndex < 0) {
    return {
      priority: selectedPreset,
      upcoming: playlistPresets.slice(0, visibleUpcoming),
    };
  }

  const upcoming: Preset[] = [];
  const upcomingCount = Math.min(visibleUpcoming, Math.max(0, playlistPresets.length - 1));
  for (let offset = 1; offset <= upcomingCount; offset += 1) {
    const preset = playlistPresets[(currentIndex + offset) % playlistPresets.length];
    if (preset) upcoming.push(preset);
  }
  return {current: selectedPreset, upcoming};
}
