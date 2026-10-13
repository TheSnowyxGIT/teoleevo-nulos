import React, {useEffect, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, useWindowSize} from 'ink';
import {
  BAND_LABELS,
  dbToLevel,
  EMPTY_BANDS,
  METER_FLOORS,
  SMOOTHING_ORDER,
  SMOOTHING_PROFILES,
  smoothLevel,
} from '../config.js';
import type {
  AppOptions,
  AudioDevice,
  BandName,
  BandValues,
  CaptureInfo,
  CaptureSource,
  CaptureStatus,
  SmoothingProfile,
} from '../types.js';
import {HelpPanel} from './help-panel.js';
import {Meter} from './meter.js';
import {SettingsPanel} from './settings-panel.js';

interface AppProps {
  source: CaptureSource;
  options: AppOptions;
}

const BANDS: BandName[] = ['bass', 'mids', 'treble'];
const HISTORY_LENGTH = 120;

function nextInList<T>(items: readonly T[], current: T, direction: 1 | -1): T {
  const currentIndex = Math.max(0, items.indexOf(current));
  return items[(currentIndex + direction + items.length) % items.length] ?? current;
}

export function App({source, options}: AppProps): React.JSX.Element {
  const {exit} = useApp();
  const {columns} = useWindowSize();
  const [status, setStatus] = useState<CaptureStatus>({
    state: 'starting',
    message: 'Initialisation…',
  });
  const [info, setInfo] = useState<CaptureInfo>();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [db, setDb] = useState<BandValues>({bass: -Infinity, mids: -Infinity, treble: -Infinity});
  const [levels, setLevels] = useState<BandValues>(EMPTY_BANDS);
  const [history, setHistory] = useState<Record<BandName, number[]>>({
    bass: [],
    mids: [],
    treble: [],
  });
  const [hasSignal, setHasSignal] = useState(false);
  const [paused, setPaused] = useState(false);
  const [smoothing, setSmoothing] = useState<SmoothingProfile>('balanced');
  const [meterFloor, setMeterFloor] = useState(options.meterFloor);
  const [showHistory, setShowHistory] = useState(true);
  const [panel, setPanel] = useState<'none' | 'settings' | 'help'>('none');
  const [selectedRow, setSelectedRow] = useState(0);

  const pausedRef = useRef(paused);
  const smoothingRef = useRef(smoothing);
  const meterFloorRef = useRef(meterFloor);
  const levelsRef = useRef<BandValues>(EMPTY_BANDS);
  pausedRef.current = paused;
  smoothingRef.current = smoothing;
  meterFloorRef.current = meterFloor;

  useEffect(() => {
    void source
      .start({
        onDevices: setDevices,
        onInfo: setInfo,
        onStatus: setStatus,
        onFrame: frame => {
          if (pausedRef.current) return;
          setHasSignal(frame.hasSignal);
          setDb(frame.db);
          const next = {...levelsRef.current};
          for (const band of BANDS) {
            next[band] = smoothLevel(
              levelsRef.current[band],
              dbToLevel(frame.db[band], meterFloorRef.current),
              smoothingRef.current,
            );
          }
          levelsRef.current = next;
          setLevels(next);
          setHistory(previousHistory => ({
            bass: [...previousHistory.bass, next.bass].slice(-HISTORY_LENGTH),
            mids: [...previousHistory.mids, next.mids].slice(-HISTORY_LENGTH),
            treble: [...previousHistory.treble, next.treble].slice(-HISTORY_LENGTH),
          }));
        },
      })
      .catch(error =>
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );

    return () => {
      void source.stop();
    };
  }, [source]);

  const cycleDevice = (direction: 1 | -1): void => {
    if (devices.length < 2) return;
    const currentIndex = Math.max(
      0,
      devices.findIndex(device => device.id === info?.deviceId),
    );
    const device = devices[(currentIndex + direction + devices.length) % devices.length];
    if (device) void source.selectDevice(device.id);
  };

  const cycleSmoothing = (direction: 1 | -1): void => {
    setSmoothing(current => nextInList(SMOOTHING_ORDER, current, direction));
  };

  const changeSetting = (direction: 1 | -1): void => {
    switch (selectedRow) {
      case 0:
        cycleDevice(direction);
        break;
      case 1:
        cycleSmoothing(direction);
        break;
      case 2:
        setMeterFloor(current => nextInList(METER_FLOORS, current, direction));
        break;
      case 3:
        setShowHistory(current => !current);
        break;
    }
  };

  useInput((input, key) => {
    if (input.toLowerCase() === 'q' || key.escape) {
      void source.stop().finally(exit);
      return;
    }

    if (panel === 'settings') {
      if (input.toLowerCase() === 'o') setPanel('none');
      else if (key.upArrow) setSelectedRow(row => Math.max(0, row - 1));
      else if (key.downArrow) setSelectedRow(row => Math.min(3, row + 1));
      else if (key.leftArrow) changeSetting(-1);
      else if (key.rightArrow || key.return) changeSetting(1);
      return;
    }

    if (panel === 'help') {
      if (input.toLowerCase() === 'h') setPanel('none');
      return;
    }

    if (input === ' ') setPaused(current => !current);
    else if (input.toLowerCase() === 'o') setPanel('settings');
    else if (input.toLowerCase() === 'h') setPanel('help');
    else if (input.toLowerCase() === 'd') cycleDevice(1);
    else if (input.toLowerCase() === 's') cycleSmoothing(1);
  });

  const contentWidth = Math.max(46, Math.min(columns - 4, 110));
  const statusColor =
    status.state === 'running' ? 'green' : status.state === 'error' ? 'red' : 'yellow';
  const statusDot = status.state === 'running' ? '●' : status.state === 'error' ? '×' : '◌';

  return (
    <Box flexDirection="column" paddingX={1} width={contentWidth}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          TEOLEEVO <Text dimColor>// LIVE AUDIO SPECTRUM</Text>
        </Text>
        <Text color={statusColor}>
          {statusDot} {paused ? 'PAUSE' : status.state.toUpperCase()}
        </Text>
      </Box>

      <Box borderStyle="round" borderColor={statusColor} paddingX={1} marginTop={1}>
        <Box flexDirection="column" flexGrow={1}>
          <Text wrap="truncate-end">
            <Text dimColor>Source </Text>
            {info?.deviceName ?? status.message}
          </Text>
          <Text dimColor>
            {info
              ? `${(info.sampleRate / 1000).toFixed(1)} kHz · ${info.channels === 2 ? 'stéréo' : `${info.channels} canal`} · FFT ${info.fftSize}`
              : 'En attente du moteur audio…'}
          </Text>
        </Box>
        <Text color={hasSignal && !paused ? 'green' : 'gray'}>
          {hasSignal && !paused ? ' SIGNAL' : ' SILENCE'}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {BANDS.map(band => (
          <Meter
            key={band}
            {...BAND_LABELS[band]}
            level={levels[band]}
            db={db[band]}
            history={history[band]}
            width={contentWidth}
            showHistory={showHistory}
          />
        ))}
      </Box>

      {status.state === 'error' ? (
        <Box borderStyle="single" borderColor="red" paddingX={1} marginBottom={1}>
          <Text color="red">{status.message}</Text>
        </Box>
      ) : null}

      {panel === 'settings' ? (
        <SettingsPanel
          devices={devices}
          selectedDeviceId={info?.deviceId}
          smoothing={smoothing}
          meterFloor={meterFloor}
          showHistory={showHistory}
          selectedRow={selectedRow}
        />
      ) : panel === 'help' ? (
        <HelpPanel />
      ) : (
        <Box justifyContent="space-between">
          <Text dimColor>Espace pause · O options · H aide · Q quitter</Text>
          <Text dimColor>{SMOOTHING_PROFILES[smoothing].label} · {meterFloor} dB</Text>
        </Box>
      )}
    </Box>
  );
}
