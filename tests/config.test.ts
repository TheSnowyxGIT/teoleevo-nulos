import assert from 'node:assert/strict';
import test from 'node:test';
import {dbToLevel, smoothLevel} from '../src/config.js';

test('dbToLevel maps the configured display range', () => {
  assert.equal(dbToLevel(-70, -70), 0);
  assert.equal(dbToLevel(-6, -70), 1);
  assert.equal(dbToLevel(-120, -70), 0);
  assert.equal(dbToLevel(3, -70), 1);
  assert.equal(dbToLevel(-38, -70), 0.5);
});

test('smoothing attacks faster than it releases', () => {
  const attack = smoothLevel(0.2, 0.8, 'balanced') - 0.2;
  const release = 0.8 - smoothLevel(0.8, 0.2, 'balanced');
  assert.ok(attack > release);
});
