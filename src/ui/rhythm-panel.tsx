import React from 'react';
import {Box, Text} from 'ink';
import {clamp} from '../config.js';
import type {RhythmStatus} from '../types.js';

interface RhythmPanelProps {
  rhythm: RhythmStatus;
  width: number;
}

function meter(value: number, size: number): string {
  const filled = Math.round(clamp(value, 0, 1) * size);
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
}

export function RhythmPanel({rhythm, width}: RhythmPanelProps): React.JSX.Element {
  const active = rhythm.state === 'running';
  const color =
    rhythm.state === 'error' || rhythm.state === 'unavailable'
      ? 'red'
      : active
        ? rhythm.downbeat
          ? 'magenta'
          : 'green'
        : 'yellow';
  const compact = width < 72;
  const beatLabel =
    rhythm.beatPosition && rhythm.meter
      ? `${rhythm.beatPosition}/${rhythm.meter}`
      : '—/—';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} marginBottom={1}>
      <Box justifyContent="space-between">
        <Text bold>
          BEATNET{' '}
          <Text color={color}>
            {active ? '● ACTIF' : rhythm.state.toUpperCase()}
          </Text>
        </Text>
        <Text>
          <Text dimColor>BPM </Text>{rhythm.bpm?.toFixed(1) ?? '—'}
          <Text dimColor> · TEMPS </Text>{beatLabel}
        </Text>
      </Box>
      <Text color={rhythm.downbeat ? 'magenta' : rhythm.pulse ? 'green' : undefined}>
        <Text dimColor>Impulsion </Text>
        {rhythm.downbeat ? '◆ DOWNBEAT' : rhythm.pulse ? '● BEAT' : 'en écoute'}
      </Text>
      <Box justifyContent="space-between">
        <Text color="green">
          Beat {meter(rhythm.beatActivation, compact ? 8 : 12)}{' '}
          {Math.round(rhythm.beatActivation * 100)}%
        </Text>
        <Text color="magenta">
          Down {meter(rhythm.downbeatActivation, compact ? 8 : 12)}{' '}
          {Math.round(rhythm.downbeatActivation * 100)}%
        </Text>
      </Box>
      <Text dimColor wrap="truncate-end">
        {rhythm.message}
        {rhythm.latencyMs !== undefined ? ` · retard ${Math.round(rhythm.latencyMs)} ms` : ''}
      </Text>
    </Box>
  );
}
