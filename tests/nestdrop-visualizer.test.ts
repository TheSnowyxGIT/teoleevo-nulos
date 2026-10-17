import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nestDropOutputValues,
  nestDropRegistryValues,
} from '../src/visualizer/nestdrop-visualizer.js';

test('NestDrop settings use the renderer native scales', () => {
  assert.deepEqual(
    nestDropRegistryValues({frameRate: 30, speed: 1.07175, audioGain: 1}),
    {
      TargetFPS: 30,
      AnimationSpeed: 1072,
      Channel: 3,
      Bass: 1000,
      Mid: 1000,
      Treble: 1000,
    },
  );
});

test('NestDrop audio reaction is clamped to its native 0..1 range', () => {
  assert.equal(
    nestDropRegistryValues({frameRate: 30, speed: 0.05, audioGain: 2}).Bass,
    1000,
  );
});

test('NestDrop renders with the selected display aspect ratio', () => {
  assert.deepEqual(nestDropOutputValues({width: 3440, height: 1440}), {
    SpoutWidth: 3440,
    SpoutHeight: 1440,
  });
});
