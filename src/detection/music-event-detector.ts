import {clamp} from '../config.js';
import type {
  MusicEventAnalysis,
  RhythmStatus,
  SpectrumFrame,
} from '../types.js';

interface AudioSample {
  timestamp: number;
  loudness: number;
  subBass: number;
  lowMid: number;
  highMid: number;
  centroid: number;
  flux: number;
}

interface BeatObservation extends AudioSample {
  impactDb: number;
  bassImpactDb: number;
}

interface BarSummary {
  loudness: number;
  subBass: number;
  lowMid: number;
  highMid: number;
  centroid: number;
  flux: number;
  beatCount: number;
}

const EMPTY_METRICS: MusicEventAnalysis['metrics'] = {
  drop: 0,
  impact: 0,
  bassReturn: 0,
  buildUp: 0,
  novelty: 0,
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function upperMean(values: number[]): number {
  if (values.length === 0) return -120;
  const sorted = [...values].sort((left, right) => right - left);
  return mean(sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2))));
}

function rangeScore(value: number, start: number, full: number): number {
  return clamp((value - start) / (full - start), 0, 1);
}

function linearRise(values: number[], fullRise: number): number {
  if (values.length < 3) return 0;
  const xMean = (values.length - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index += 1) {
    numerator += (index - xMean) * ((values[index] ?? yMean) - yMean);
    denominator += (index - xMean) ** 2;
  }
  const totalRise = denominator === 0 ? 0 : (numerator / denominator) * (values.length - 1);
  return clamp(totalRise / fullRise, 0, 1);
}

export function initialMusicEvent(message = 'En attente du rythme BeatNet'): MusicEventAnalysis {
  return {
    state: 'waiting',
    message,
    confidence: 0,
    dropTriggered: false,
    barsObserved: 0,
    metrics: {...EMPTY_METRICS},
  };
}

/**
 * Detects musical transitions on BeatNet's rhythmic grid. Absolute levels are
 * never thresholds: every score is relative to recent beats and bars, which
 * makes a master-volume change much less likely to become a false drop.
 */
export class MusicEventDetector {
  private samples: AudioSample[] = [];
  private beats: BeatObservation[] = [];
  private currentBar: BeatObservation[] = [];
  private bars: BarSummary[] = [];
  private barNumber = 0;
  private lastDropBar = -100;
  private dropBeatsRemaining = 0;
  private pendingBeat?: {rhythm: RhythmStatus; evaluateAfter: number};
  private latest = initialMusicEvent();

  addFrame(frame: SpectrumFrame): void {
    if (!frame.hasSignal) return;
    this.samples.push({
      timestamp: frame.timestamp,
      loudness: frame.features.loudnessDb,
      subBass: frame.features.subBassDb,
      lowMid: frame.features.lowMidDb,
      highMid: frame.features.highMidDb,
      centroid: frame.features.spectralCentroid,
      flux: frame.features.spectralFlux,
    });
    const cutoff = frame.timestamp - 20_000;
    while ((this.samples[0]?.timestamp ?? cutoff) < cutoff) this.samples.shift();
  }

  reset(message?: string): MusicEventAnalysis {
    this.samples = [];
    this.beats = [];
    this.currentBar = [];
    this.bars = [];
    this.barNumber = 0;
    this.lastDropBar = -100;
    this.dropBeatsRemaining = 0;
    this.pendingBeat = undefined;
    this.latest = initialMusicEvent(message);
    return this.latest;
  }

  onRhythm(rhythm: RhythmStatus): MusicEventAnalysis | undefined {
    if (rhythm.state !== 'running') {
      if (this.latest.state === 'waiting' && !rhythm.message) return undefined;
      this.latest = initialMusicEvent(
        rhythm.state === 'unavailable' || rhythm.state === 'error'
          ? 'BeatNet est requis pour aligner les changements musicaux'
          : 'En attente du rythme BeatNet',
      );
      return this.latest;
    }

    if (rhythm.pulse) {
      const audioTime = this.samples.at(-1)?.timestamp;
      if (audioTime !== undefined) {
        this.pendingBeat = {rhythm, evaluateAfter: audioTime + 80};
      }
      return undefined;
    }

    if (this.pendingBeat) {
      const audioTime = this.samples.at(-1)?.timestamp;
      if (audioTime !== undefined && audioTime >= this.pendingBeat.evaluateAfter) {
        const pending = this.pendingBeat;
        this.pendingBeat = undefined;
        return this.processBeat(pending.rhythm);
      }
    }

    if (!rhythm.pulse) {
      if (this.latest.state !== 'waiting') return undefined;
      this.latest = this.analysis(
        'learning',
        'Synchronisation avec les premières mesures…',
        0,
        false,
        EMPTY_METRICS,
      );
      return this.latest;
    }

    return undefined;
  }

  private processBeat(rhythm: RhythmStatus): MusicEventAnalysis | undefined {
    const observation = this.observeBeat();
    if (!observation) return undefined;
    this.beats.push(observation);
    this.beats = this.beats.slice(-96);

    const boundary = rhythm.downbeat || rhythm.beatPosition === 1;
    if (boundary && this.currentBar.length >= 2) {
      this.bars.push(this.summarizeBar(this.currentBar));
      this.bars = this.bars.slice(-32);
      this.currentBar = [];
      this.barNumber += 1;
    }
    this.currentBar.push(observation);

    if (this.dropBeatsRemaining > 0) {
      this.dropBeatsRemaining -= 1;
      this.latest = {
        ...this.latest,
        state: 'drop',
        message: 'Drop confirmé · maintien pendant deux mesures',
        dropTriggered: false,
        barsObserved: this.bars.length,
      };
      return this.latest;
    }

    if (this.bars.length < 3) {
      this.latest = this.analysis(
        'learning',
        `Apprentissage du morceau · ${this.bars.length}/3 mesures`,
        this.bars.length / 3,
        false,
        EMPTY_METRICS,
      );
      return this.latest;
    }

    const metrics = this.score(observation);
    const context = Math.max(metrics.buildUp, this.quietBeforeScore());
    const boundaryDrop =
      boundary &&
      metrics.drop >= 0.62 &&
      metrics.impact >= 0.34 &&
      (metrics.bassReturn >= 0.3 || metrics.novelty >= 0.58);
    const exceptionalOffbeatDrop =
      !boundary &&
      metrics.drop >= 0.86 &&
      metrics.impact >= 0.72 &&
      metrics.bassReturn >= 0.58 &&
      context >= 0.45;
    const outsideCooldown = this.barNumber - this.lastDropBar >= 4;

    if ((boundaryDrop || exceptionalOffbeatDrop) && outsideCooldown) {
      this.lastDropBar = this.barNumber;
      this.dropBeatsRemaining = Math.max(4, (rhythm.meter ?? 4) * 2) - 1;
      this.latest = this.analysis(
        'drop',
        'DROP détecté · événement unique prêt pour le changement de preset',
        metrics.drop,
        true,
        metrics,
      );
      this.latest.dropTimestamp = observation.timestamp;
      return this.latest;
    }

    if (metrics.buildUp >= 0.56) {
      this.latest = this.analysis(
        'build-up',
        'Montée d’énergie sur plusieurs mesures',
        metrics.buildUp,
        false,
        metrics,
      );
      return this.latest;
    }

    const breakdown = this.breakdownScore();
    if (breakdown >= 0.62) {
      this.latest = this.analysis(
        'breakdown',
        'Énergie et basses sous leur niveau récent',
        breakdown,
        false,
        metrics,
      );
      return this.latest;
    }

    this.latest = this.analysis(
      'neutral',
      'Aucune transition suffisamment nette',
      1 - metrics.drop,
      false,
      metrics,
    );
    return this.latest;
  }

  private observeBeat(): BeatObservation | undefined {
    const now = this.samples.at(-1)?.timestamp;
    if (now === undefined) return undefined;
    const recent = this.samples.filter(sample => sample.timestamp >= now - 240);
    const before = this.samples.filter(
      sample => sample.timestamp >= now - 1_100 && sample.timestamp < now - 300,
    );
    if (recent.length === 0) return undefined;

    const loudness = upperMean(recent.map(sample => sample.loudness));
    const subBass = upperMean(recent.map(sample => sample.subBass));
    const lowMid = upperMean(recent.map(sample => sample.lowMid));
    const highMid = upperMean(recent.map(sample => sample.highMid));
    return {
      timestamp: now,
      loudness,
      subBass,
      lowMid,
      highMid,
      centroid: mean(recent.map(sample => sample.centroid)),
      flux: Math.max(...recent.map(sample => sample.flux)),
      impactDb: before.length
        ? loudness - median(before.map(sample => sample.loudness))
        : 0,
      bassImpactDb: before.length
        ? subBass - median(before.map(sample => sample.subBass))
        : 0,
    };
  }

  private summarizeBar(observations: BeatObservation[]): BarSummary {
    return {
      loudness: mean(observations.map(beat => beat.loudness)),
      subBass: mean(observations.map(beat => beat.subBass)),
      lowMid: mean(observations.map(beat => beat.lowMid)),
      highMid: mean(observations.map(beat => beat.highMid)),
      centroid: mean(observations.map(beat => beat.centroid)),
      flux: mean(observations.map(beat => beat.flux)),
      beatCount: observations.length,
    };
  }

  private score(observation: BeatObservation): MusicEventAnalysis['metrics'] {
    const previous = this.bars.at(-1);
    if (!previous) return {...EMPTY_METRICS};
    const recentBars = this.bars.slice(-12);
    const baselineLoudness = median(recentBars.map(bar => bar.loudness));
    const baselineFlux = median(this.beats.slice(-48, -1).map(beat => beat.flux));
    const fluxDeviation = median(
      this.beats
        .slice(-48, -1)
        .map(beat => Math.abs(beat.flux - baselineFlux)),
    );

    const energyLift = observation.loudness - previous.loudness;
    const bassLift = observation.subBass - previous.subBass;
    const lowMidLift = observation.lowMid - previous.lowMid;
    const highMidLift = observation.highMid - previous.highMid;
    const bassContrastBefore = previous.subBass - (previous.lowMid + previous.highMid) / 2;
    const bassContrastNow = observation.subBass - (observation.lowMid + observation.highMid) / 2;
    const bassContrastLift = bassContrastNow - bassContrastBefore;

    const instantImpact = Math.max(
      rangeScore(observation.impactDb, 2.5, 9),
      rangeScore(observation.bassImpactDb, 3, 11),
    );
    const barImpact = rangeScore(energyLift, 2, 10);
    let impact = Math.max(instantImpact, barImpact);
    let bassReturn =
      rangeScore(bassLift, 2, 12) * 0.62 +
      rangeScore(bassContrastLift, 1, 8) * 0.38;
    const fluxSpike = rangeScore(
      observation.flux - baselineFlux,
      Math.max(0.025, fluxDeviation * 1.5),
      Math.max(0.12, fluxDeviation * 6),
    );
    const novelty = clamp(
      rangeScore(Math.abs(energyLift), 2, 10) * 0.3 +
        rangeScore(Math.abs(bassLift), 2, 12) * 0.3 +
        rangeScore(Math.abs(highMidLift), 2, 10) * 0.2 +
        fluxSpike * 0.2,
      0,
      1,
    );

    // A master-volume step moves every band by almost the same number of dB.
    // Penalize that signature unless the spectral shape also changes strongly.
    const bandLifts = [bassLift, lowMidLift, highMidLift];
    const liftSpread = Math.max(...bandLifts) - Math.min(...bandLifts);
    const uniformGainStep =
      energyLift > 3.5 &&
      liftSpread < 1.8 &&
      Math.abs(bassContrastLift) < 1.4 &&
      fluxSpike < 0.55;
    if (uniformGainStep) {
      impact *= 0.25;
      bassReturn *= 0.2;
    }

    const buildUp = this.buildUpScore();
    const quietBefore = rangeScore(baselineLoudness - previous.loudness, 2.5, 10);
    const context = Math.max(buildUp, quietBefore, novelty * 0.65);
    const drop = clamp(
      impact * 0.29 +
        bassReturn * 0.26 +
        fluxSpike * 0.2 +
        context * 0.15 +
        novelty * 0.1,
      0,
      1,
    );

    return {drop, impact, bassReturn, buildUp, novelty};
  }

  private buildUpScore(): number {
    const bars = this.bars.slice(-4);
    if (bars.length < 3) return 0;
    const energyRise = linearRise(bars.map(bar => bar.loudness), 7);
    const brightnessRise = linearRise(bars.map(bar => bar.highMid), 8);
    const fluxRise = linearRise(bars.map(bar => bar.flux), 0.18);
    const earlierBass = median(bars.slice(0, -1).map(bar => bar.subBass));
    const bassRemoval = rangeScore(earlierBass - (bars.at(-1)?.subBass ?? earlierBass), 3, 11);
    return clamp(
      energyRise * 0.34 +
        brightnessRise * 0.22 +
        fluxRise * 0.24 +
        bassRemoval * 0.2,
      0,
      1,
    );
  }

  private quietBeforeScore(): number {
    if (this.bars.length < 3) return 0;
    const previous = this.bars.at(-1);
    if (!previous) return 0;
    const baseline = median(this.bars.slice(-12).map(bar => bar.loudness));
    return rangeScore(baseline - previous.loudness, 2.5, 10);
  }

  private breakdownScore(): number {
    if (this.bars.length < 4) return 0;
    const latest = this.bars.at(-1);
    if (!latest) return 0;
    const comparison = this.bars.slice(-9, -1);
    const energyLoss = median(comparison.map(bar => bar.loudness)) - latest.loudness;
    const bassLoss = median(comparison.map(bar => bar.subBass)) - latest.subBass;
    return clamp(
      rangeScore(energyLoss, 4, 12) * 0.58 +
        rangeScore(bassLoss, 4, 14) * 0.42,
      0,
      1,
    );
  }

  private analysis(
    state: MusicEventAnalysis['state'],
    message: string,
    confidence: number,
    dropTriggered: boolean,
    metrics: MusicEventAnalysis['metrics'],
  ): MusicEventAnalysis {
    return {
      state,
      message,
      confidence: clamp(confidence, 0, 1),
      dropTriggered,
      barsObserved: this.bars.length,
      metrics: {...metrics},
    };
  }
}
