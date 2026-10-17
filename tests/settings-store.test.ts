import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  defaultUserSettings,
  SettingsStore,
} from '../src/persistence/settings-store.js';

test('SettingsStore returns defaults when no file exists', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'teoleevo-settings-'));
  try {
    const store = new SettingsStore(path.join(directory, 'settings.json'));
    assert.deepEqual(await store.load(), defaultUserSettings());
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

test('SettingsStore persists options and custom playlists', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'teoleevo-settings-'));
  try {
    const store = new SettingsStore(path.join(directory, 'nested', 'settings.json'));
    const settings = {
      ...defaultUserSettings(),
      deviceId: 'speakers',
      smoothing: 'fast' as const,
      meterFloor: -60,
      showHistory: false,
      selectedDisplayId: String.raw`\\.\DISPLAY2`,
      selectedPlaylistId: 'custom:show',
      presetTagFilter: 'drop' as const,
      autoSwitchEnabled: true,
      autoSwitchSeconds: 8,
      shuffleEnabled: true,
      customPlaylists: [
        {id: 'custom:show', name: 'Show', presetIds: ['one.milk', 'two.milk']},
      ],
    };
    await store.save(settings);
    assert.deepEqual(await store.load(), settings);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

test('SettingsStore ignores invalid custom playlists and clamps options', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'teoleevo-settings-'));
  const filePath = path.join(directory, 'settings.json');
  try {
    await writeFile(filePath, JSON.stringify({
      meterFloor: -200,
      visualizerSettings: {frameRate: 500, speed: -2, audioGain: 8},
      autoSwitchEnabled: 'yes',
      autoSwitchSeconds: 9000,
      shuffleEnabled: 1,
      customPlaylists: [
        {id: 'tag:drop', name: 'Invalid', presetIds: []},
        {id: 'custom:ok', name: 'Valid', presetIds: ['a', 'a', 4]},
      ],
    }));
    const settings = await new SettingsStore(filePath).load();
    assert.equal(settings.meterFloor, -100);
    assert.deepEqual(settings.visualizerSettings, {frameRate: 120, speed: 0, audioGain: 1});
    assert.equal(settings.autoSwitchEnabled, false);
    assert.equal(settings.autoSwitchSeconds, 3600);
    assert.equal(settings.shuffleEnabled, false);
    assert.deepEqual(settings.customPlaylists, [
      {id: 'custom:ok', name: 'Valid', presetIds: ['a']},
    ]);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
