import React from 'react';
import {Box, Text} from 'ink';

const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

interface MeterProps {
  label: string;
  range: string;
  color: string;
  level: number;
  db: number;
  history: number[];
  width: number;
  showHistory: boolean;
  compact?: boolean;
}

function meterBar(level: number, width: number): string {
  const boundedWidth = Math.max(8, width);
  const filled = Math.round(level * boundedWidth);
  return `${'█'.repeat(filled)}${'░'.repeat(boundedWidth - filled)}`;
}

function sparkline(history: number[], width: number): string {
  return history
    .slice(-width)
    .map(value => SPARK_CHARS[Math.min(7, Math.floor(value * 8))] ?? '▁')
    .join('');
}

export function Meter({
  label,
  range,
  color,
  level,
  db,
  history,
  width,
  showHistory,
  compact = false,
}: MeterProps): React.JSX.Element {
  // Fixed columns: labels (24), percentage (5), dB value (11), outer padding (2).
  const barWidth = Math.max(8, width - 42);

  return (
    <Box flexDirection="column" marginBottom={compact ? 0 : 1}>
      <Box>
        <Box width={9}>
          <Text color={color} bold>
            {label}
          </Text>
        </Box>
        <Box width={15}>
          <Text dimColor>{range}</Text>
        </Box>
        <Text color={color}>{meterBar(level, barWidth)}</Text>
        <Text> {Math.round(level * 100).toString().padStart(3)}%</Text>
        <Text dimColor> {Number.isFinite(db) ? db.toFixed(1).padStart(6) : ' -∞'} dB</Text>
      </Box>
      {showHistory ? (
        <Box marginLeft={24}>
          <Text color={color} dimColor>
            {sparkline(history, Math.max(8, width - 28))}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
