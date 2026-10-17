import assert from 'node:assert/strict';
import test from 'node:test';
import {MusicEventDetector} from '../src/detection/music-event-detector.js';
import type {AudioFeatures, RhythmStatus, SpectrumFrame} from '../src/types.js';

interface Levels {
  loudness: number;
  subBass: number;
  lowMid: number;
  highMid: number;
  flux: number;
  centroid?: number;
}

const STEADY: Levels = {
  loudness: -25,
  subBass: -27,
  lowMid: -25,
  highMid: -29,
  flux: 0.08,
  centroid: 1_600,
};

function frame(timestamp: number, levels: Levels): SpectrumFrame {
  const features: AudioFeatures = {
    loudnessDb: levels.loudness,
    subBassDb: levels.subBass,
    lowMidDb: levels.lowMid,
    highMidDb: levels.highMid,
    spectralFlux: levels.flux,
    spectralCentroid: levels.centroid ?? 1_600,
  };
  return {
    timestamp,
    hasSignal: true,
    db: {bass: levels.subBass, mids: levels.lowMid, treble: levels.highMid},
    features,
  };
}

function rhythm(position: number, downbeat = position === 1): RhythmStatus {
  return {
    state: 'running',
    message: downbeat ? 'Downbeat détecté' : 'Beat détecté',
    bpm: 120,
    beatPosition: position,
    meter: 4,
    beatActivation: 0.9,
    downbeatActivation: downbeat ? 0.9 : 0.1,
    pulse: true,
    downbeat,
  };
}

function emitBeat(
  detector: MusicEventDetector,
  timestamp: number,
  position: number,
  levels: Levels,
) {
  detector.addFrame(frame(timestamp - 200, levels));
  detector.addFrame(frame(timestamp - 100, levels));
  detector.addFrame(frame(timestamp, levels));
  const pulse = rhythm(position);
  detector.onRhythm(pulse);
  detector.addFrame(frame(timestamp + 100, levels));
  return detector.onRhythm({...pulse, pulse: false, downbeat: false});
}

function emitBar(
  detector: MusicEventDetector,
  start: number,
  levels: Levels,
): number {
  let timestamp = start;
  for (let position = 1; position <= 4; position += 1) {
    emitBeat(detector, timestamp, position, levels);
    timestamp += 500;
  }
  return timestamp;
}

test('learns several complete bars before classifying transitions', () => {
  const detector = new MusicEventDetector();
  let timestamp = 1_000;
  timestamp = emitBar(detector, timestamp, STEADY);
  timestamp = emitBar(detector, timestamp, STEADY);
  const analysis = emitBeat(detector, timestamp, 1, STEADY);

  assert.equal(analysis?.state, 'learning');
  assert.equal(analysis?.barsObserved, 2);
});

test('detects a bass-heavy impact after a quiet build and only triggers once', () => {
  const detector = new MusicEventDetector();
  let timestamp = 1_000;
  timestamp = emitBar(detector, timestamp, STEADY);
  timestamp = emitBar(detector, timestamp, {...STEADY, loudness: -24, highMid: -27});
  timestamp = emitBar(detector, timestamp, {
    ...STEADY,
    loudness: -23,
    subBass: -31,
    highMid: -24,
    flux: 0.14,
  });
  timestamp = emitBar(detector, timestamp, {
    loudness: -32,
    subBass: -42,
    lowMid: -31,
    highMid: -25,
    flux: 0.2,
    centroid: 2_800,
  });

  const drop = emitBeat(detector, timestamp, 1, {
    loudness: -15,
    subBass: -13,
    lowMid: -20,
    highMid: -21,
    flux: 0.72,
    centroid: 2_100,
  });
  const held = emitBeat(detector, timestamp + 500, 2, {
    loudness: -17,
    subBass: -15,
    lowMid: -21,
    highMid: -23,
    flux: 0.28,
  });

  assert.equal(drop?.state, 'drop');
  assert.equal(drop?.dropTriggered, true);
  assert.ok((drop?.metrics.drop ?? 0) >= 0.62);
  assert.equal(held?.state, 'drop');
  assert.equal(held?.dropTriggered, false);
});

test('does not call a uniform master-volume step a drop', () => {
  const detector = new MusicEventDetector();
  let timestamp = 1_000;
  for (let bar = 0; bar < 4; bar += 1) {
    timestamp = emitBar(detector, timestamp, STEADY);
  }

  const louder = emitBeat(detector, timestamp, 1, {
    loudness: STEADY.loudness + 10,
    subBass: STEADY.subBass + 10,
    lowMid: STEADY.lowMid + 10,
    highMid: STEADY.highMid + 10,
    flux: STEADY.flux,
    centroid: STEADY.centroid,
  });

  assert.notEqual(louder?.state, 'drop');
  assert.equal(louder?.dropTriggered, false);
});

test('reports a build-up from a multi-bar rise without firing a drop', () => {
  const detector = new MusicEventDetector();
  let timestamp = 1_000;
  timestamp = emitBar(detector, timestamp, {
    ...STEADY,
    loudness: -34,
    highMid: -40,
    flux: 0.04,
  });
  timestamp = emitBar(detector, timestamp, {
    ...STEADY,
    loudness: -32,
    highMid: -36,
    flux: 0.08,
  });
  timestamp = emitBar(detector, timestamp, {
    ...STEADY,
    loudness: -28,
    highMid: -30,
    flux: 0.15,
  });

  const analysis = emitBeat(detector, timestamp, 1, {
    ...STEADY,
    loudness: -28,
    highMid: -30,
    flux: 0.15,
  });

  assert.equal(analysis?.state, 'build-up');
  assert.equal(analysis?.dropTriggered, false);
  assert.ok((analysis?.metrics.buildUp ?? 0) >= 0.56);
});
