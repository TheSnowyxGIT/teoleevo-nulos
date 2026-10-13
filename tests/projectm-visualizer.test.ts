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
  );

  assert.ok(args.includes('--preset'));
  assert.ok(args.includes('--texture'));
  assert.ok(args.includes('--device-id'));
  assert.ok(args.includes('speaker-id'));
});
