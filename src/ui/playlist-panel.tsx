import React from 'react';
import {Box, Text} from 'ink';
import type {Playlist} from '../types.js';

export type PlaylistDialog =
  | {type: 'browse'}
  | {type: 'merge'; selectedIds: string[]}
  | {
      type: 'name';
      operation: 'new' | 'copy' | 'merge' | 'rename';
      sourceIds: string[];
      value: string;
    }
  | {type: 'delete'; playlistId: string};

interface PlaylistPanelProps {
  playlists: Playlist[];
  activePlaylistId: string;
  selectedIndex: number;
  dialog: PlaylistDialog;
}

const VISIBLE_ROWS = 10;

export function PlaylistPanel({
  playlists,
  activePlaylistId,
  selectedIndex,
  dialog,
}: PlaylistPanelProps): React.JSX.Element {
  const firstRow = Math.max(
    0,
    Math.min(selectedIndex - 4, Math.max(0, playlists.length - VISIBLE_ROWS)),
  );
  const selected = playlists[selectedIndex];

  return (
    <Box borderStyle="round" borderColor="green" paddingX={2} flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold color="green">PLAYLISTS</Text>
        <Text dimColor>{playlists.length} disponible(s)</Text>
      </Box>
      {dialog.type === 'name' ? (
        <>
          <Text color="yellow">
            {dialog.operation === 'rename' ? 'Nouveau nom' : 'Nom de la playlist'}
            {' › '}
            <Text color="cyan">{dialog.value || 'saisissez un nom…'}</Text>
          </Text>
          <Text dimColor>Entrée confirmer · Échap annuler · Retour effacer</Text>
        </>
      ) : dialog.type === 'delete' ? (
        <>
          <Text color="red">Supprimer « {selected?.name} » ?</Text>
          <Text dimColor>Y confirmer · N ou Échap annuler</Text>
        </>
      ) : dialog.type === 'merge' ? (
        <>
          <Text color="yellow">Choisissez toutes les playlists à fusionner</Text>
          <Text dimColor>
            Espace cocher · Entrée continuer ({dialog.selectedIds.length} sélectionnée{dialog.selectedIds.length > 1 ? 's' : ''}) · Échap annuler
          </Text>
        </>
      ) : (
        <Text dimColor>Entrée ouvrir · A activer · N nouvelle · C copier · M fusionner · R renommer · D supprimer · L fermer</Text>
      )}
      <Box height={1} />
      {playlists.slice(firstRow, firstRow + VISIBLE_ROWS).map((playlist, rowIndex) => {
        const absoluteIndex = firstRow + rowIndex;
        const highlighted = absoluteIndex === selectedIndex;
        const active = playlist.id === activePlaylistId;
        const mergeSelected = dialog.type === 'merge' && dialog.selectedIds.includes(playlist.id);
        return (
          <Box key={playlist.id}>
            <Box width={3}><Text color={highlighted ? 'green' : undefined}>{highlighted ? '›' : ' '}</Text></Box>
            <Box width={4}>
              <Text color={mergeSelected ? 'green' : 'cyan'}>
                {dialog.type === 'merge' ? (mergeSelected ? '[✓]' : '[ ]') : active ? '●' : ' '}
              </Text>
            </Box>
            <Box width={23}><Text bold={highlighted} wrap="truncate-end">{playlist.name}</Text></Box>
            <Box width={12}><Text color={playlist.readonly ? 'yellow' : 'magenta'}>{playlist.readonly ? 'SYSTÈME' : 'PERSO'}</Text></Box>
            <Text dimColor>{playlist.presetIds.length} preset(s)</Text>
          </Box>
        );
      })}
    </Box>
  );
}
