import assert from 'node:assert/strict';
import test from 'node:test';
import {parseCli} from '../src/cli-options.js';

test('parseCli uses production defaults', () => {
  const parsed = parseCli([]);
  assert.equal(parsed.options.demo, false);
  assert.equal(parsed.options.fftSize, 2048);
  assert.equal(parsed.options.fps, 30);
  assert.equal(parsed.options.meterFloor, -70);
  assert.equal(parsed.options.beatNet, true);
  assert.equal(parsed.options.autoDropPresets, false);
  assert.deepEqual(parsed.options.visualizerSettings, {
    frameRate: 30,
    speed: 1.07175,
    audioGain: 1,
  });
});

test('parseCli accepts supported analysis options', () => {
  const parsed = parseCli([
    '--demo',
    '--fft-size',
    '4096',
    '--fps',
    '60',
    '--floor',
    '-80',
    '--device',
    'speaker-id',
    '--preset-dir',
    'presets',
    '--texture-dir',
    'textures',
    '--renderer',
    'projectMSDL.exe',
    '--nestdrop-renderer',
    'NestDrop_SpoutSender.exe',
    '--visual-speed',
    '0.05',
    '--visual-fps',
    '24',
    '--visual-volume',
    '0.5',
    '--no-beatnet',
    '--auto-drop',
  ]);

  assert.deepEqual(parsed.options, {
    demo: true,
    fftSize: 4096,
    fps: 60,
    meterFloor: -80,
    deviceId: 'speaker-id',
    presetDirectory: 'presets',
    textureDirectory: 'textures',
    rendererPath: 'projectMSDL.exe',
    nestDropRendererPath: 'NestDrop_SpoutSender.exe',
    beatNet: false,
    autoDropPresets: true,
    visualizerSettings: {
      frameRate: 24,
      speed: 0.05,
      audioGain: 0.5,
    },
  });
});

test('parseCli rejects unsupported values', () => {
  assert.throws(() => parseCli(['--fft-size', '1000']), /1024, 2048 ou 4096/);
  assert.throws(() => parseCli(['--fps', '2']), /entre 10 et 60/);
  assert.throws(() => parseCli(['--visual-speed', '-0.1']), /entre 0 et 2/);
  assert.throws(() => parseCli(['--visual-fps', '2']), /entre 10 et 120/);
  assert.throws(() => parseCli(['--visual-volume', '1.1']), /entre 0 et 1/);
  assert.throws(() => parseCli(['--wat']), /Option inconnue/);
});
