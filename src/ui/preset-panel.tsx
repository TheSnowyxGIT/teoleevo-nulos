import React from 'react';
import {Box, Text} from 'ink';
import path from 'node:path';
import type {Preset} from '../types.js';
import {
  PRESET_TAG_FILTERS,
  PRESET_TAG_LABELS,
  type PresetTagFilter,
} from '../presets/tags.js';

interface PresetPanelProps {
  presets: Preset[];
  query: string;
  selectedIndex: number;
  currentPreset?: Preset;
  tagFilter: PresetTagFilter;
}

const VISIBLE_ROWS = 9;

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, Math.max(1, length - 1))}…`;
}

export function PresetPanel({
  presets,
  query,
  selectedIndex,
  currentPreset,
  tagFilter,
}: PresetPanelProps): React.JSX.Element {
  const firstRow = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(VISIBLE_ROWS / 2),
      Math.max(0, presets.length - VISIBLE_ROWS),
    ),
  );
  const rows = presets.slice(firstRow, firstRow + VISIBLE_ROWS);

  return (
    <Box borderStyle="round" borderColor="magenta" paddingX={2} flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold color="magenta">
          PRESETS MILKDROP
        </Text>
        <Text dimColor>{presets.length} résultat(s)</Text>
      </Box>
      <Text>
        <Text dimColor>Recherche </Text>
        <Text color="cyan">{query || 'tapez pour filtrer…'}</Text>
      </Text>
      <Box>
        <Text dimColor>Tags </Text>
        {PRESET_TAG_FILTERS.map(tag => (
          <Text key={tag} color={tag === tagFilter ? 'yellow' : 'gray'} bold={tag === tagFilter}>
            {tag === tagFilter ? `[${PRESET_TAG_LABELS[tag]}] ` : `${PRESET_TAG_LABELS[tag]} `}
          </Text>
        ))}
      </Box>
      <Text dimColor>Tab changer le tag · ↑/↓ choisir · Entrée ouvrir · Retour effacer · Échap fermer</Text>
      <Box height={1} />
      {presets.length === 0 ? (
        <Text color="yellow">
          Aucun preset. Configurez --preset-dir &lt;dossier&gt;.
        </Text>
      ) : (
        rows.map((preset, rowIndex) => {
          const absoluteIndex = firstRow + rowIndex;
          const selected = absoluteIndex === selectedIndex;
          const active = preset.id === currentPreset?.id;
          const folder = path.dirname(preset.relativePath);
          return (
            <Box key={preset.id}>
              <Box width={3}>
                <Text color={selected ? 'magenta' : undefined}>{selected ? '›' : ' '}</Text>
              </Box>
              <Box width={2}>
                <Text color="green">{active ? '●' : ' '}</Text>
              </Box>
              <Text bold={selected} color={selected ? 'cyan' : undefined}>
                {truncate(preset.name, 50)}
              </Text>
              <Text color={preset.tags.includes('drop') ? 'red' : preset.tags.includes('build-up') ? 'yellow' : preset.tags.includes('verse') ? 'blue' : 'gray'}>
                {' '}[{preset.tags.map(tag => PRESET_TAG_LABELS[tag]).join(', ')}]
              </Text>
              {folder !== '.' ? <Text dimColor> · {truncate(folder, 28)}</Text> : null}
            </Box>
          );
        })
      )}
    </Box>
  );
}
