import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, useWindowSize} from 'ink';
import {
  ANIMATION_SPEEDS,
  BAND_LABELS,
  dbToLevel,
  EMPTY_BANDS,
  METER_FLOORS,
  SMOOTHING_ORDER,
  SMOOTHING_PROFILES,
  smoothLevel,
  VISUAL_FRAME_RATES,
  VISUAL_AUDIO_GAINS,
} from '../config.js';
import type {
  AppOptions,
  AudioDevice,
  BandName,
  BandValues,
  CaptureInfo,
  CaptureSource,
  CaptureStatus,
  MusicEventAnalysis,
  RhythmStatus,
  Preset,
  SmoothingProfile,
  VisualizerController,
  VisualizerSettings,
  VisualizerStatus,
} from '../types.js';
import {initialMusicEvent, MusicEventDetector} from '../detection/music-event-detector.js';
import {
  PRESET_TAG_FILTERS,
  type PresetTagFilter,
} from '../presets/tags.js';
import {HelpPanel} from './help-panel.js';
import {Meter} from './meter.js';
import {MusicEventPanel} from './music-event-panel.js';
import {PresetPanel} from './preset-panel.js';
import {RhythmPanel} from './rhythm-panel.js';
import {SettingsPanel} from './settings-panel.js';

interface AppProps {
  source: CaptureSource;
  options: AppOptions;
  presets: Preset[];
  visualizer: VisualizerController;
}

const BANDS: BandName[] = ['bass', 'mids', 'treble'];
const HISTORY_LENGTH = 120;

function nextInList<T>(items: readonly T[], current: T, direction: 1 | -1): T {
  const currentIndex = Math.max(0, items.indexOf(current));
  return items[(currentIndex + direction + items.length) % items.length] ?? current;
}

export function App({source, options, presets, visualizer}: AppProps): React.JSX.Element {
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
  const [rhythm, setRhythm] = useState<RhythmStatus>({
    state: options.beatNet ? 'starting' : 'disabled',
    message: options.beatNet ? 'Chargement de BeatNet…' : 'BeatNet désactivé',
    beatActivation: 0,
    downbeatActivation: 0,
    pulse: false,
    downbeat: false,
  });
  const [musicEvent, setMusicEvent] = useState<MusicEventAnalysis>(() =>
    initialMusicEvent(),
  );
  const [paused, setPaused] = useState(false);
  const [smoothing, setSmoothing] = useState<SmoothingProfile>('balanced');
  const [meterFloor, setMeterFloor] = useState(options.meterFloor);
  const [showHistory, setShowHistory] = useState(true);
  const [autoDropPresets, setAutoDropPresets] = useState(options.autoDropPresets);
  const [visualizerSettings, setVisualizerSettings] = useState<VisualizerSettings>(
    options.visualizerSettings,
  );
  const [panel, setPanel] = useState<'none' | 'settings' | 'help' | 'presets'>('none');
  const [selectedRow, setSelectedRow] = useState(0);
  const [presetQuery, setPresetQuery] = useState('');
  const [presetTagFilter, setPresetTagFilter] = useState<PresetTagFilter>('all');
  const [presetIndex, setPresetIndex] = useState(0);
  const [currentPreset, setCurrentPreset] = useState<Preset>();
  const [visualizerStatus, setVisualizerStatus] = useState<VisualizerStatus>(
    visualizer.initialStatus,
  );

  const pausedRef = useRef(paused);
  const smoothingRef = useRef(smoothing);
  const meterFloorRef = useRef(meterFloor);
  const levelsRef = useRef<BandValues>(EMPTY_BANDS);
  const detectorRef = useRef(new MusicEventDetector());
  const deviceIdRef = useRef<string | undefined>(undefined);
  const handledDropRef = useRef<number | undefined>(undefined);
  pausedRef.current = paused;
  smoothingRef.current = smoothing;
  meterFloorRef.current = meterFloor;

  useEffect(() => {
    void source
      .start({
        onDevices: setDevices,
        onInfo: nextInfo => {
          if (deviceIdRef.current && deviceIdRef.current !== nextInfo.deviceId) {
            setMusicEvent(
              detectorRef.current.reset('Nouvelle sortie · apprentissage relancé'),
            );
          }
          deviceIdRef.current = nextInfo.deviceId;
          setInfo(nextInfo);
        },
        onStatus: setStatus,
        onRhythm: nextRhythm => {
          setRhythm(nextRhythm);
          const nextEvent = detectorRef.current.onRhythm(nextRhythm);
          if (nextEvent) setMusicEvent(nextEvent);
        },
        onFrame: frame => {
          detectorRef.current.addFrame(frame);
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

  useEffect(() => visualizer.subscribe(setVisualizerStatus), [visualizer]);

  useEffect(() => {
    if (info?.deviceId) void visualizer.selectAudioDevice(info.deviceId, info.deviceName);
  }, [info?.deviceId, info?.deviceName, visualizer]);

  useEffect(
    () => () => {
      void visualizer.stop();
    },
    [visualizer],
  );

  const filteredPresets = useMemo(() => {
    const normalizedQuery = presetQuery.trim().toLocaleLowerCase();
    return presets.filter(
      preset =>
        (presetTagFilter === 'all' || preset.tags.includes(presetTagFilter)) &&
        (normalizedQuery.length === 0 ||
          preset.relativePath.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [presets, presetQuery, presetTagFilter]);

  const showPreset = (preset: Preset): void => {
    setCurrentPreset(preset);
    setPanel('none');
    void visualizer.showPreset(preset);
  };

  const cyclePreset = (direction: 1 | -1): void => {
    if (presets.length === 0) return;
    const currentIndex = presets.findIndex(preset => preset.id === currentPreset?.id);
    const targetIndex =
      currentIndex < 0
        ? direction === 1
          ? 0
          : presets.length - 1
        : (currentIndex + direction + presets.length) % presets.length;
    const preset = presets[targetIndex];
    if (preset) showPreset(preset);
  };

  useEffect(() => {
    const dropTimestamp = musicEvent.dropTimestamp;
    if (!musicEvent.dropTriggered || dropTimestamp === undefined) return;
    if (handledDropRef.current === dropTimestamp) return;
    handledDropRef.current = dropTimestamp;
    if (!autoDropPresets || visualizerStatus.state !== 'running') return;

    const visualPresets = presets.some(
      preset => !preset.relativePath.startsWith('! Transition'),
    )
      ? presets.filter(preset => !preset.relativePath.startsWith('! Transition'))
      : presets;
    const currentIndex = visualPresets.findIndex(
      preset => preset.id === currentPreset?.id,
    );
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % visualPresets.length;
    const nextPreset = visualPresets[nextIndex];
    if (nextPreset) {
      setCurrentPreset(nextPreset);
      setPanel('none');
      void visualizer.showPreset(nextPreset);
    }
  }, [
    autoDropPresets,
    currentPreset?.id,
    musicEvent.dropTimestamp,
    musicEvent.dropTriggered,
    presets,
    visualizer,
    visualizerStatus.state,
  ]);

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

  const changeVisualizerSetting = <Key extends keyof VisualizerSettings>(
    key: Key,
    values: readonly VisualizerSettings[Key][],
    direction: 1 | -1,
  ): void => {
    setVisualizerSettings(current => {
      const next = {...current, [key]: nextInList(values, current[key], direction)};
      void visualizer.configure(next);
      return next;
    });
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
      case 4:
        changeVisualizerSetting('frameRate', VISUAL_FRAME_RATES, direction);
        break;
      case 5:
        changeVisualizerSetting('speed', ANIMATION_SPEEDS, direction);
        break;
      case 6:
        changeVisualizerSetting('audioGain', VISUAL_AUDIO_GAINS, direction);
        break;
      case 7:
        setAutoDropPresets(current => !current);
        break;
    }
  };

  useInput((input, key) => {
    if (panel === 'presets') {
      if (key.escape || input.toLowerCase() === 'p') {
        setPanel('none');
      } else if (key.tab) {
        setPresetTagFilter(current =>
          nextInList(PRESET_TAG_FILTERS, current, key.shift ? -1 : 1),
        );
        setPresetIndex(0);
      } else if (key.upArrow) {
        setPresetIndex(index => Math.max(0, index - 1));
      } else if (key.downArrow) {
        setPresetIndex(index =>
          Math.min(Math.max(0, filteredPresets.length - 1), index + 1),
        );
      } else if (key.pageUp) {
        setPresetIndex(index => Math.max(0, index - 8));
      } else if (key.pageDown) {
        setPresetIndex(index =>
          Math.min(Math.max(0, filteredPresets.length - 1), index + 8),
        );
      } else if (key.return) {
        const preset = filteredPresets[presetIndex];
        if (preset) showPreset(preset);
      } else if (key.backspace || key.delete) {
        setPresetQuery(query => query.slice(0, -1));
        setPresetIndex(0);
      } else if (!key.ctrl && !key.meta && input && !/\p{C}/u.test(input)) {
        setPresetQuery(query => query + input);
        setPresetIndex(0);
      }
      return;
    }

    if (input.toLowerCase() === 'q' || key.escape) {
      void Promise.all([source.stop(), visualizer.stop()]).finally(exit);
      return;
    }

    if (panel === 'settings') {
      if (input.toLowerCase() === 'o') setPanel('none');
      else if (key.upArrow) setSelectedRow(row => Math.max(0, row - 1));
      else if (key.downArrow) setSelectedRow(row => Math.min(7, row + 1));
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
    else if (input.toLowerCase() === 'p') {
      setPresetQuery('');
      const presetsForCurrentTag =
        presetTagFilter === 'all'
          ? presets
          : presets.filter(preset => preset.tags.includes(presetTagFilter));
      setPresetIndex(
        Math.max(
          0,
          presetsForCurrentTag.findIndex(preset => preset.id === currentPreset?.id),
        ),
      );
      setPanel('presets');
    } else if (input.toLowerCase() === 'v') {
      if (visualizerStatus.state === 'running' || visualizerStatus.state === 'starting') {
        void visualizer.stop();
      } else if (currentPreset) {
        void visualizer.showPreset(currentPreset);
      } else {
        const firstVisualPreset =
          presets.find(preset => !preset.relativePath.startsWith('! Transition')) ?? presets[0];
        if (firstVisualPreset) showPreset(firstVisualPreset);
      }
    } else if (input.toLowerCase() === 'n') cyclePreset(1);
    else if (input.toLowerCase() === 'b') cyclePreset(-1);
    else if (input.toLowerCase() === 'd') cycleDevice(1);
    else if (input.toLowerCase() === 's') cycleSmoothing(1);
    else if (input.toLowerCase() === 'a') setAutoDropPresets(current => !current);
  });

  const contentWidth = Math.max(46, Math.min(columns - 4, 110));
  const statusColor =
    status.state === 'running' ? 'green' : status.state === 'error' ? 'red' : 'yellow';
  const statusDot = status.state === 'running' ? '●' : status.state === 'error' ? '×' : '◌';
  const statusLabel = paused
    ? 'PAUSE'
    : status.state === 'running'
      ? 'AUDIO ACTIF'
      : status.state.toUpperCase();
  const visualizerColor =
    visualizerStatus.state === 'running'
      ? 'magenta'
      : visualizerStatus.state === 'error' || visualizerStatus.state === 'unavailable'
        ? 'red'
        : 'gray';

  return (
    <Box flexDirection="column" paddingX={1} width={contentWidth}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          TEOLEEVO <Text dimColor>// LIVE AUDIO SPECTRUM</Text>
        </Text>
        <Text color={statusColor}>
          {statusDot} {statusLabel}
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

      <RhythmPanel rhythm={rhythm} width={contentWidth} />

      <MusicEventPanel
        analysis={musicEvent}
        width={contentWidth}
        autoPreset={autoDropPresets}
        autoPresetArmed={
          autoDropPresets &&
          rhythm.state === 'running' &&
          visualizerStatus.state === 'running' &&
          presets.length > 0
        }
      />

      <Box borderStyle="round" borderColor={visualizerColor} paddingX={1} marginBottom={1}>
        <Box flexDirection="column" flexGrow={1}>
          <Text wrap="truncate-end">
            <Text dimColor>Preset </Text>
            {currentPreset?.name ?? 'Aucun preset sélectionné'}
          </Text>
          <Text dimColor wrap="truncate-end">
            {visualizerStatus.message}
          </Text>
        </Box>
        <Text color={visualizerColor}>
          {visualizerStatus.state === 'running' ? ' VISUEL ACTIF' : ` ${presets.length} .MILK`}
        </Text>
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
          autoDropPresets={autoDropPresets}
          visualizerSettings={visualizerSettings}
          selectedRow={selectedRow}
        />
      ) : panel === 'help' ? (
        <HelpPanel />
      ) : panel === 'presets' ? (
        <PresetPanel
          presets={filteredPresets}
          query={presetQuery}
          selectedIndex={presetIndex}
          currentPreset={currentPreset}
          tagFilter={presetTagFilter}
        />
      ) : (
        <Box justifyContent="space-between">
          <Text dimColor>P presets · V visuel · A auto-drop · O options · Q quitter</Text>
          <Text dimColor>{SMOOTHING_PROFILES[smoothing].label} · {meterFloor} dB</Text>
        </Box>
      )}
    </Box>
  );
}
