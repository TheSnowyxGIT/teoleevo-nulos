import React from 'react';
import {Box, Text} from 'ink';
import {SMOOTHING_PROFILES} from '../config.js';
import type {AudioDevice, SmoothingProfile, VisualizerSettings} from '../types.js';

interface SettingsPanelProps {
  devices: AudioDevice[];
  selectedDeviceId?: string;
  smoothing: SmoothingProfile;
  meterFloor: number;
  showHistory: boolean;
  autoDropPresets: boolean;
  visualizerSettings: VisualizerSettings;
  selectedRow: number;
}

function Row({
  active,
  label,
  value,
}: {
  active: boolean;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <Box>
      <Box width={3}>
        <Text color="cyan">{active ? '›' : ' '}</Text>
      </Box>
      <Box width={20}>
        <Text bold={active}>{label}</Text>
      </Box>
      <Text color={active ? 'cyan' : undefined}>{value}</Text>
    </Box>
  );
}

export function SettingsPanel({
  devices,
  selectedDeviceId,
  smoothing,
  meterFloor,
  showHistory,
  autoDropPresets,
  visualizerSettings,
  selectedRow,
}: SettingsPanelProps): React.JSX.Element {
  const selectedDevice = devices.find(device => device.id === selectedDeviceId);

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={2} flexDirection="column">
      <Text bold color="cyan">
        OPTIONS
      </Text>
      <Text dimColor>↑/↓ sélectionner · ←/→ modifier · O fermer</Text>
      <Box height={1} />
      <Row
        active={selectedRow === 0}
        label="Sortie audio"
        value={selectedDevice?.name ?? 'Automatique / défaut Windows'}
      />
      <Row
        active={selectedRow === 1}
        label="Réactivité"
        value={SMOOTHING_PROFILES[smoothing].label}
      />
      <Row
        active={selectedRow === 2}
        label="Plancher vumètre"
        value={`${meterFloor} dB`}
      />
      <Row
        active={selectedRow === 3}
        label="Historique"
        value={showHistory ? 'Visible' : 'Masqué'}
      />
      <Row
        active={selectedRow === 4}
        label="FPS / fluidité"
        value={`${visualizerSettings.frameRate} FPS`}
      />
      <Row
        active={selectedRow === 5}
        label="Vitesse globale"
        value={`${visualizerSettings.speed.toLocaleString('fr-FR')}×`}
      />
      <Row
        active={selectedRow === 6}
        label="Volume visuel"
        value={`${visualizerSettings.audioGain.toLocaleString('fr-FR')}×`}
      />
      <Row
        active={selectedRow === 7}
        label="Preset sur drop"
        value={autoDropPresets ? 'Activé' : 'Désactivé'}
      />
    </Box>
  );
}
