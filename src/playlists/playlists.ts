import {randomUUID} from 'node:crypto';
import type {CustomPlaylist, Playlist, Preset, PresetTag} from '../types.js';

export const DEFAULT_PLAYLIST_TAGS: readonly PresetTag[] = [
  'build-up',
  'drop',
  'verse',
  'other',
];

export const DEFAULT_PLAYLIST_ID = 'tag:other';

const DEFAULT_NAMES: Record<PresetTag, string> = {
  'build-up': 'Build-up',
  drop: 'Drop',
  verse: 'Verse',
  other: 'Other',
};

export function buildPlaylists(
  presets: Preset[],
  customPlaylists: CustomPlaylist[],
): Playlist[] {
  const availableIds = new Set(presets.map(preset => preset.id));
  const defaults = DEFAULT_PLAYLIST_TAGS.map(tag => ({
    id: `tag:${tag}`,
    name: DEFAULT_NAMES[tag],
    presetIds: presets
      .filter(preset => preset.tags.includes(tag))
      .map(preset => preset.id),
    readonly: true,
  }));
  const custom = customPlaylists.map(playlist => ({
    ...playlist,
    presetIds: uniqueIds(playlist.presetIds).filter(id => availableIds.has(id)),
    readonly: false,
  }));
  return [...defaults, ...custom];
}

export function createCustomPlaylist(
  name: string,
  presetIds: string[] = [],
  id = `custom:${randomUUID()}`,
): CustomPlaylist {
  return {id, name: name.trim(), presetIds: uniqueIds(presetIds)};
}

export function mergePresetIds(...playlists: Playlist[]): string[] {
  return uniqueIds(playlists.flatMap(playlist => playlist.presetIds));
}

export function uniquePlaylistName(name: string, playlists: Playlist[]): string {
  const base = name.trim() || 'Nouvelle playlist';
  const existing = new Set(playlists.map(playlist => playlist.name.toLocaleLowerCase()));
  if (!existing.has(base.toLocaleLowerCase())) return base;
  let suffix = 2;
  while (existing.has(`${base} (${suffix})`.toLocaleLowerCase())) suffix += 1;
  return `${base} (${suffix})`;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
