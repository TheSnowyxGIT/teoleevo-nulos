import path from 'node:path';
import React from 'react';
import {Box, Text} from 'ink';
import {PRESET_TAG_FILTERS, PRESET_TAG_LABELS, type PresetTagFilter} from '../presets/tags.js';
import type {Playlist, Preset} from '../types.js';

export type PlaylistDetailMode = 'contents' | 'catalog';

interface PlaylistDetailPanelProps {
  playlist: Playlist;
  presets: Preset[];
  mode: PlaylistDetailMode;
  query: string;
  tagFilter: PresetTagFilter;
  selectedIndex: number;
  currentPresetId?: string;
  active: boolean;
  compact?: boolean;
}

const VISIBLE_ROWS = 10;

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, Math.max(1, length - 1))}…`;
}

export function PlaylistDetailPanel({
  playlist,
  presets,
  mode,
  query,
  tagFilter,
  selectedIndex,
  currentPresetId,
  active,
  compact = false,
}: PlaylistDetailPanelProps): React.JSX.Element {
  const visibleRows = compact ? 8 : VISIBLE_ROWS;
  const firstRow = Math.max(
    0,
    Math.min(selectedIndex - 4, Math.max(0, presets.length - visibleRows)),
  );
  const members = new Set(playlist.presetIds);

  return (
    <Box borderStyle="round" borderColor="magenta" paddingX={2} flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold color="magenta">PLAYLIST · {playlist.name}</Text>
        <Text color={playlist.readonly ? 'yellow' : 'magenta'}>
          {active ? '● ACTIVE · ' : ''}{playlist.readonly ? 'SYSTÈME' : 'PERSO'}
        </Text>
      </Box>

      <Box>
        <Text color={mode === 'contents' ? 'cyan' : 'gray'} bold={mode === 'contents'}>
          {mode === 'contents' ? '[CONTENU]' : 'CONTENU'}
        </Text>
        {!playlist.readonly ? (
          <Text color={mode === 'catalog' ? 'cyan' : 'gray'} bold={mode === 'catalog'}>
            {mode === 'catalog' ? '  [AJOUTER / RETIRER]' : '  AJOUTER / RETIRER'}
          </Text>
        ) : null}
      </Box>

      {mode === 'catalog' ? (
        <>
          <Text><Text dimColor>Recherche </Text><Text color="cyan">{query || 'tapez pour filtrer…'}</Text></Text>
          <Box>
            <Text dimColor>Tags </Text>
            {PRESET_TAG_FILTERS.map(tag => (
              <Text key={tag} color={tag === tagFilter ? 'yellow' : 'gray'} bold={tag === tagFilter}>
                {tag === tagFilter ? `[${PRESET_TAG_LABELS[tag]}] ` : `${PRESET_TAG_LABELS[tag]} `}
              </Text>
            ))}
          </Box>
          <Text dimColor>
            {compact
              ? 'Entrée ajouter/retirer · ←/→ tag · Tab contenu · Échap retour'
              : 'Entrée ajouter/retirer · ←/→ changer le tag · Tab contenu · Échap retour'}
          </Text>
        </>
      ) : (
        <Text dimColor>
          Entrée lire · A activer · ↑/↓ choisir
          {playlist.readonly ? ' · lecture seule' : ' · X retirer · Tab modifier'}
          {' · Échap retour'}
        </Text>
      )}

      {!compact ? <Box height={1} /> : null}
      {presets.length === 0 ? (
        <Text color="yellow">
          {mode === 'contents'
            ? playlist.readonly
              ? 'Cette playlist ne contient aucun preset.'
              : 'Playlist vide. Appuyez sur Tab pour ajouter des presets.'
            : 'Aucun preset pour cette recherche.'}
        </Text>
      ) : presets.slice(firstRow, firstRow + visibleRows).map((preset, rowIndex) => {
        const absoluteIndex = firstRow + rowIndex;
        const highlighted = absoluteIndex === selectedIndex;
        const folder = path.dirname(preset.relativePath);
        const playing = preset.id === currentPresetId;
        return (
          <Box key={preset.id} height={1} overflowX="hidden">
            <Box width={3}><Text color={highlighted ? 'magenta' : undefined}>{highlighted ? '›' : ' '}</Text></Box>
            <Box width={5}>
              {mode === 'catalog' ? (
                <Text color={members.has(preset.id) ? 'green' : 'gray'}>
                  {members.has(preset.id) ? '[✓]' : '[ ]'}
                </Text>
              ) : (
                <Text color={playing ? 'green' : 'gray'}>{playing ? '▶' : `${absoluteIndex + 1}.`}</Text>
              )}
            </Box>
            <Box flexGrow={1}>
              <Text
                bold={highlighted || playing}
                color={playing ? 'green' : highlighted ? 'cyan' : undefined}
                wrap="truncate-end"
              >
                {truncate(preset.name, compact ? 42 : 50)}
                {!compact && folder !== '.' ? <Text dimColor> · {truncate(folder, 26)}</Text> : null}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
