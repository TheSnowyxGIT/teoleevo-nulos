import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  resolveNestDropInstallation,
  scanPresets,
} from '../src/presets/catalog.js';
import {tagsForPresetName} from '../src/presets/tags.js';

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
    assert.deepEqual(presets[0]?.tags, ['other']);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

test('curated presets can belong to several music sections', () => {
  assert.deepEqual(tagsForPresetName('101'), ['build-up', 'drop']);
  assert.deepEqual(tagsForPresetName('cortex meat - mighty mend-it'), [
    'drop',
    'verse',
  ]);
  assert.deepEqual(tagsForPresetName('unlisted preset'), ['other']);
});

test('scanPresets explains a missing directory', async () => {
  await assert.rejects(scanPresets('/definitely/missing/presets'), /introuvable/);
});

test('resolveNestDropInstallation derives and validates the complete layout', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'teoleevo-nestdrop-'));
  try {
    const milkDropDirectory = path.join(directory, 'Plugins', 'Milkdrop2');
    await Promise.all([
      mkdir(path.join(milkDropDirectory, 'Presets'), {recursive: true}),
      mkdir(path.join(milkDropDirectory, 'Textures'), {recursive: true}),
    ]);
    await writeFile(path.join(directory, 'Plugins', 'NestDrop_SpoutSender.exe'), '');

    assert.deepEqual(resolveNestDropInstallation(directory), {
      directory,
      presetDirectory: path.join(milkDropDirectory, 'Presets'),
      textureDirectory: path.join(milkDropDirectory, 'Textures'),
      rendererPath: path.join(directory, 'Plugins', 'NestDrop_SpoutSender.exe'),
    });
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

test('resolveNestDropInstallation rejects an incomplete copy', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'teoleevo-nestdrop-'));
  try {
    assert.throws(
      () => resolveNestDropInstallation(directory),
      /Installation NestDrop incomplète/,
    );
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
