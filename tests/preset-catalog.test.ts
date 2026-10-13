import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {scanPresets} from '../src/presets/catalog.js';

test('scanPresets finds .milk files recursively and sorts them', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'teoleevo-presets-'));
  try {
    await mkdir(path.join(directory, 'Nested'));
    await Promise.all([
      writeFile(path.join(directory, 'zeta.milk'), '[preset00]\n'),
      writeFile(path.join(directory, 'Nested', 'Alpha.MILK'), '[preset00]\n'),
      writeFile(path.join(directory, 'preview.jpg'), ''),
    ]);

    const presets = await scanPresets(directory);
    assert.deepEqual(
      presets.map(preset => preset.relativePath),
      [path.join('Nested', 'Alpha.MILK'), 'zeta.milk'],
    );
    assert.equal(presets[0]?.name, 'Alpha');
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

test('scanPresets explains a missing directory', async () => {
  await assert.rejects(scanPresets('/definitely/missing/presets'), /introuvable/);
});
