import React from 'react';
import {Box, Text} from 'ink';
import {clamp} from '../config.js';
import type {MusicEventAnalysis, MusicEventState} from '../types.js';

interface MusicEventPanelProps {
  analysis: MusicEventAnalysis;
  width: number;
  autoPreset: boolean;
  autoPresetArmed: boolean;
}

const LABELS: Record<MusicEventState, string> = {
  waiting: 'EN ATTENTE',
  learning: 'APPRENTISSAGE',
  neutral: 'NEUTRE',
  'build-up': 'BUILD-UP',
  drop: 'DROP',
  breakdown: 'BREAKDOWN',
};

const COLORS: Record<MusicEventState, string> = {
  waiting: 'gray',
  learning: 'yellow',
  neutral: 'gray',
  'build-up': 'cyan',
  drop: 'magenta',
  breakdown: 'blue',
};

function meter(value: number, size: number): string {
  const filled = Math.round(clamp(value, 0, 1) * size);
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
}

export function MusicEventPanel({
  analysis,
  width,
  autoPreset,
  autoPresetArmed,
}: MusicEventPanelProps): React.JSX.Element {
  const color = COLORS[analysis.state];
  const compact = width < 78;
  const meterSize = compact ? 7 : 10;
  const percent = (value: number): string => `${Math.round(value * 100)}%`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text bold>
          ÉVÉNEMENT MUSICAL{' '}
          <Text color={color} bold={analysis.state === 'drop'}>
            {analysis.state === 'drop' ? '⚡ ' : ''}{LABELS[analysis.state]}
          </Text>
        </Text>
        <Text dimColor>
          confiance {percent(analysis.confidence)} · {analysis.barsObserved} mesures
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color="magenta">
          Drop {meter(analysis.metrics.drop, meterSize)} {percent(analysis.metrics.drop)}
        </Text>
        <Text color="yellow">
          Impact {percent(analysis.metrics.impact)} · Bass {percent(analysis.metrics.bassReturn)}
        </Text>
        {!compact ? (
          <Text color="cyan">
            Build {percent(analysis.metrics.buildUp)} · Nouveau {percent(analysis.metrics.novelty)}
          </Text>
        ) : null}
      </Box>
      <Text color={analysis.dropTriggered ? 'magenta' : undefined} dimColor={!analysis.dropTriggered}>
        {analysis.dropTriggered ? '⚡ DÉCLENCHEMENT DROP · ' : ''}{analysis.message}
      </Text>
      <Text dimColor={!autoPresetArmed} color={autoPresetArmed ? 'green' : undefined}>
        Preset automatique :{' '}
        {autoPreset ? (autoPresetArmed ? 'ARMÉ' : 'en attente du visuel et d’un preset') : 'DÉSACTIVÉ'}
      </Text>
    </Box>
  );
}
