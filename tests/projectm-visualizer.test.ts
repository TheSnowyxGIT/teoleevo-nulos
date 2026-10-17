import assert from 'node:assert/strict';
import test from 'node:test';
import {rendererArguments} from '../src/visualizer/projectm-visualizer.js';

test('rendererArguments passes the selected preset and exact audio device', () => {
  const args = rendererArguments(
    '/tmp/projectm',
    {
      id: 'test.milk',
      name: 'Test',
      path: '/tmp/test.milk',
      relativePath: 'test.milk',
    },
    ['/tmp/textures'],
    'speaker-id',
    {
      frameRate: 24,
      speed: 0.05,
      audioGain: 2,
    },
  );

  assert.ok(args.includes('--preset'));
  assert.ok(args.includes('--texture'));
  assert.ok(args.includes('--device-id'));
  assert.ok(args.includes('speaker-id'));
  assert.deepEqual(args.slice(args.indexOf('--speed'), args.indexOf('--speed') + 2), [
    '--speed',
    '0.05',
  ]);
  assert.deepEqual(args.slice(args.indexOf('--fps'), args.indexOf('--fps') + 2), [
    '--fps',
    '24',
  ]);
  assert.deepEqual(
    args.slice(args.indexOf('--audio-gain'), args.indexOf('--audio-gain') + 2),
    ['--audio-gain', '2'],
  );
});
