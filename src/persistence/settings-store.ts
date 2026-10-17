import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DEFAULT_OPTIONS} from '../config.js';
import {DEFAULT_PLAYLIST_ID} from '../playlists/playlists.js';
import type {AppOptions, CustomPlaylist, UserSettings} from '../types.js';

const smoothingValues = new Set(['fast', 'balanced', 'smooth']);
const tagFilterValues = new Set(['all', 'build-up', 'drop', 'verse', 'other']);

export function defaultSettingsPath(): string {
  const explicit = process.env['TEOLEEVO_CONFIG_PATH'];
  if (explicit) return path.resolve(explicit);
  if (process.platform === 'win32' && process.env['APPDATA']) {
    return path.join(process.env['APPDATA'], 'Teoleevo', 'settings.json');
  }
  const configRoot = process.env['XDG_CONFIG_HOME'] ?? path.join(os.homedir(), '.config');
  return path.join(configRoot, 'teoleevo', 'settings.json');
}

export function defaultUserSettings(): UserSettings {
  return {
    version: 1,
    smoothing: 'balanced',
    meterFloor: DEFAULT_OPTIONS.meterFloor,
    showHistory: true,
    visualizerSettings: {...DEFAULT_OPTIONS.visualizerSettings},
    selectedPlaylistId: DEFAULT_PLAYLIST_ID,
    presetTagFilter: 'all',
    customPlaylists: [],
    autoSwitchEnabled: false,
    autoSwitchSeconds: 4,
    shuffleEnabled: false,
  };
}

export function optionsFromSettings(settings: UserSettings): AppOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...(process.env['TEOLEEVO_NESTDROP_DIR'] || settings.nestDropDirectory
      ? {nestDropDirectory: process.env['TEOLEEVO_NESTDROP_DIR'] ?? settings.nestDropDirectory}
      : {}),
    ...(settings.deviceId ? {deviceId: settings.deviceId} : {}),
    meterFloor: settings.meterFloor,
    visualizerSettings: {...settings.visualizerSettings},
  };
}

export class SettingsStore {
  private pending = Promise.resolve();

  constructor(readonly filePath = defaultSettingsPath()) {}

  async load(): Promise<UserSettings> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, 'utf8'));
      return parseSettings(value);
    } catch (error) {
      if (isMissingFile(error) || error instanceof SyntaxError) return defaultUserSettings();
      throw error;
    }
  }

  save(settings: UserSettings): Promise<void> {
    this.pending = this.pending.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), {recursive: true});
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.filePath);
    });
    return this.pending;
  }
}

function parseSettings(value: unknown): UserSettings {
  const defaults = defaultUserSettings();
  if (!isRecord(value)) return defaults;
  const visualizer = isRecord(value['visualizerSettings'])
    ? value['visualizerSettings']
    : {};
  return {
    version: 1,
    ...(typeof value['nestDropDirectory'] === 'string' && value['nestDropDirectory'].trim()
      ? {nestDropDirectory: value['nestDropDirectory'].trim()}
      : {}),
    ...(typeof value['deviceId'] === 'string' ? {deviceId: value['deviceId']} : {}),
    smoothing: smoothingValues.has(String(value['smoothing']))
      ? (value['smoothing'] as UserSettings['smoothing'])
      : defaults.smoothing,
    meterFloor: finiteNumber(value['meterFloor'], defaults.meterFloor, -100, -30),
    showHistory:
      typeof value['showHistory'] === 'boolean' ? value['showHistory'] : defaults.showHistory,
    visualizerSettings: {
      frameRate: finiteNumber(
        visualizer['frameRate'],
        defaults.visualizerSettings.frameRate,
        10,
        120,
      ),
      speed: finiteNumber(visualizer['speed'], defaults.visualizerSettings.speed, 0, 2),
      audioGain: finiteNumber(
        visualizer['audioGain'],
        defaults.visualizerSettings.audioGain,
        0,
        1,
      ),
    },
    ...(typeof value['selectedDisplayId'] === 'string'
      ? {selectedDisplayId: value['selectedDisplayId']}
      : {}),
    selectedPlaylistId:
      typeof value['selectedPlaylistId'] === 'string'
        ? value['selectedPlaylistId']
        : defaults.selectedPlaylistId,
    presetTagFilter: tagFilterValues.has(String(value['presetTagFilter']))
      ? (value['presetTagFilter'] as UserSettings['presetTagFilter'])
      : defaults.presetTagFilter,
    customPlaylists: parseCustomPlaylists(value['customPlaylists']),
    autoSwitchEnabled:
      typeof value['autoSwitchEnabled'] === 'boolean'
        ? value['autoSwitchEnabled']
        : defaults.autoSwitchEnabled,
    autoSwitchSeconds: finiteNumber(
      value['autoSwitchSeconds'],
      defaults.autoSwitchSeconds,
      1,
      3600,
    ),
    shuffleEnabled:
      typeof value['shuffleEnabled'] === 'boolean'
        ? value['shuffleEnabled']
        : defaults.shuffleEnabled,
  };
}

function parseCustomPlaylists(value: unknown): CustomPlaylist[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const playlists: CustomPlaylist[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = item['id'];
    const name = item['name'];
    const presetIds = item['presetIds'];
    if (
      typeof id !== 'string' ||
      !id.startsWith('custom:') ||
      ids.has(id) ||
      typeof name !== 'string' ||
      !name.trim() ||
      !Array.isArray(presetIds)
    ) continue;
    ids.add(id);
    playlists.push({
      id,
      name: name.trim(),
      presetIds: [...new Set(presetIds.filter((entry): entry is string => typeof entry === 'string'))],
    });
  }
  return playlists;
}

function finiteNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error['code'] === 'ENOENT';
}
