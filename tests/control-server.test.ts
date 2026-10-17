import assert from 'node:assert/strict';
import test from 'node:test';
import {CONTROL_PAGE} from '../src/control/page.js';
import {LocalControlServer} from '../src/control/server.js';
import type {ControlCommand, ControlState} from '../src/control/types.js';

const initialState: ControlState = {
  audio: {
    state: 'running',
    message: 'Test',
    hasSignal: true,
    paused: false,
    db: {bass: -12, mids: -18, treble: -24},
    levels: {bass: 0.8, mids: 0.6, treble: 0.4},
  },
  visualizer: {
    state: 'stopped',
    message: 'Arrêté',
    running: false,
    fullscreen: false,
  },
  queue: {upcomingIds: []},
  settings: {
    smoothing: 'balanced',
    meterFloor: -70,
    showHistory: true,
    uiFps: 10,
    visualizer: {frameRate: 60, speed: 1, audioGain: 1},
    presetTagFilter: 'all',
    autoSwitchEnabled: false,
    autoSwitchSeconds: 4,
    autoSwitchRemaining: 0,
    shuffleEnabled: false,
  },
};

test('control page contains valid browser JavaScript', () => {
  const script = CONTROL_PAGE.match(/<script>([\s\S]*)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});

test('LocalControlServer serves state and dispatches protected commands', async () => {
  const server = new LocalControlServer(0);
  await server.start();
  try {
    server.updateState(initialState);
    const page = await fetch(server.url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /TEOLEEVO \/\/ LOCAL CONTROL/);

    const snapshot = await fetch(`${server.url}/api/snapshot`).then(
      response => response.json() as Promise<{state: ControlState}>,
    );
    assert.equal(snapshot.state.audio.levels.bass, 0.8);

    let received: ControlCommand | undefined;
    server.subscribe(command => {
      received = command;
    });
    const accepted = await fetch(`${server.url}/api/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Teoleevo-Control': '1',
      },
      body: JSON.stringify({type: 'cycle-preset', direction: 1}),
    });
    assert.equal(accepted.status, 202);
    assert.deepEqual(received, {type: 'cycle-preset', direction: 1});

    const refused = await fetch(`${server.url}/api/command`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({type: 'quit'}),
    });
    assert.equal(refused.status, 403);
  } finally {
    await server.stop();
  }
});
