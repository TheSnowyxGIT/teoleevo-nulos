import assert from 'node:assert/strict';
import test from 'node:test';
import {parseCli} from '../src/cli-options.js';

test('parseCli uses production defaults', () => {
  const parsed = parseCli([]);
  assert.equal(parsed.options.demo, false);
  assert.equal(parsed.options.fftSize, 2048);
  assert.equal(parsed.options.fps, 30);
  assert.equal(parsed.options.meterFloor, -70);
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
  ]);

  assert.deepEqual(parsed.options, {
    demo: true,
    fftSize: 4096,
    fps: 60,
    meterFloor: -80,
    deviceId: 'speaker-id',
  });
});

test('parseCli rejects unsupported values', () => {
  assert.throws(() => parseCli(['--fft-size', '1000']), /1024, 2048 ou 4096/);
  assert.throws(() => parseCli(['--fps', '2']), /entre 10 et 60/);
  assert.throws(() => parseCli(['--wat']), /Option inconnue/);
});
