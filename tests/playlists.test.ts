import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPlaylists,
  createCustomPlaylist,
  mergePresetIds,
  uniquePlaylistName,
} from '../src/playlists/playlists.js';
import {buildPresetQueue} from '../src/playlists/queue.js';
import type {Playlist, Preset} from '../src/types.js';

const presets: Preset[] = [
  {id: 'a', name: 'A', path: '/a', relativePath: 'a.milk', tags: ['build-up']},
  {id: 'b', name: 'B', path: '/b', relativePath: 'b.milk', tags: ['drop', 'verse']},
  {id: 'c', name: 'C', path: '/c', relativePath: 'c.milk', tags: ['other']},
];

test('buildPlaylists creates four tag playlists and keeps custom order', () => {
  const custom = createCustomPlaylist('Show', ['c', 'missing', 'a', 'c'], 'custom:test');
  const playlists = buildPlaylists(presets, [custom]);
  assert.deepEqual(playlists.slice(0, 4).map(playlist => playlist.id), [
    'tag:build-up',
    'tag:drop',
    'tag:verse',
    'tag:other',
  ]);
  assert.deepEqual(playlists[4]?.presetIds, ['c', 'a']);
  assert.equal(playlists[0]?.readonly, true);
  assert.equal(playlists[4]?.readonly, false);
});

test('mergePresetIds preserves order and removes duplicates', () => {
  const first: Playlist = {id: '1', name: 'One', presetIds: ['a', 'b'], readonly: true};
  const second: Playlist = {id: '2', name: 'Two', presetIds: ['b', 'c'], readonly: false};
  const third: Playlist = {id: '3', name: 'Three', presetIds: ['d', 'a'], readonly: false};
  assert.deepEqual(mergePresetIds(first, second, third), ['a', 'b', 'c', 'd']);
});

test('uniquePlaylistName avoids ambiguous duplicate names', () => {
  const existing: Playlist[] = [
    {id: '1', name: 'Verse', presetIds: [], readonly: true},
    {id: '2', name: 'Verse (2)', presetIds: [], readonly: false},
  ];
  assert.equal(uniquePlaylistName('verse', existing), 'verse (3)');
});

test('buildPresetQueue puts an external selection before the active playlist', () => {
  const external: Preset = {
    id: 'outside',
    name: 'Outside',
    path: '/outside',
    relativePath: 'outside.milk',
    tags: ['other'],
  };
  const queue = buildPresetQueue(presets, external, 2);
  assert.equal(queue.priority?.id, 'outside');
  assert.deepEqual(queue.upcoming.map(preset => preset.id), ['a', 'b']);
});

test('buildPresetQueue continues after the current playlist preset and wraps once', () => {
  const queue = buildPresetQueue(presets, presets[1], 4);
  assert.equal(queue.current?.id, 'b');
  assert.deepEqual(queue.upcoming.map(preset => preset.id), ['c', 'a']);
});
