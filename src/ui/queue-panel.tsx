import React from 'react';
import {Box, Text} from 'ink';
import {buildPresetQueue} from '../playlists/queue.js';
import type {Playlist, Preset} from '../types.js';

interface QueuePanelProps {
  playlist?: Playlist;
  presets: Preset[];
  currentPreset?: Preset;
}

export function QueuePanel({
  playlist,
  presets,
  currentPreset,
}: QueuePanelProps): React.JSX.Element {
  const queue = buildPresetQueue(presets, currentPreset, 3);

  return (
    <Box borderStyle="round" borderColor="blue" paddingX={1} flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold color="blue">FILE DE LECTURE</Text>
        <Text dimColor>{playlist?.name ?? 'Aucune playlist'} · {presets.length}</Text>
      </Box>

      {queue.priority ? (
        <Box>
          <Box width={18}><Text color="yellow">▶ PRIORITAIRE</Text></Box>
          <Text color="yellow" wrap="truncate-end">{queue.priority.name}</Text>
        </Box>
      ) : queue.current ? (
        <Box>
          <Box width={18}><Text color="green">▶ EN COURS</Text></Box>
          <Text color="green" wrap="truncate-end">{queue.current.name}</Text>
        </Box>
      ) : null}

      {queue.priority ? (
        <Text dimColor>  Puis reprise de « {playlist?.name ?? 'la playlist'} »</Text>
      ) : null}

      {queue.upcoming.length === 0 ? (
        <Text dimColor>  Aucun preset à suivre.</Text>
      ) : queue.upcoming.map((preset, index) => (
        <Box key={preset.id}>
          <Box width={18}>
            <Text dimColor>{index === 0 ? '  À SUIVRE' : `  ${index + 1}`}</Text>
          </Box>
          <Text wrap="truncate-end">{preset.name}</Text>
        </Box>
      ))}
    </Box>
  );
}
