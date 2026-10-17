import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, useWindowSize} from 'ink';
import type {ControlCommandBus} from '../control/command-bus.js';
import type {LocalControlServer} from '../control/server.js';
import type {ControlCommand} from '../control/types.js';
import {
  ANIMATION_SPEEDS,
  AUTO_SWITCH_INTERVALS,
  BAND_LABELS,
  dbToLevel,
  EMPTY_BANDS,
  METER_FLOORS,
  SMOOTHING_ORDER,
  SMOOTHING_PROFILES,
  smoothLevel,
  TERMINAL_FRAME_RATES,
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
  CustomPlaylist,
  Playlist,
  Preset,
  SmoothingProfile,
  UserSettings,
  VisualizerController,
  VisualizerDisplay,
  VisualizerSettings,
  VisualizerStatus,
} from '../types.js';
import {
  PRESET_TAG_FILTERS,
  type PresetTagFilter,
} from '../presets/tags.js';
import {
  buildPlaylists,
  createCustomPlaylist,
  DEFAULT_PLAYLIST_ID,
  mergePresetIds,
  uniquePlaylistName,
} from '../playlists/playlists.js';
import {advanceAutoSwitchCountdown} from '../playlists/auto-switch.js';
import {buildPresetQueue, nextSequentialPreset} from '../playlists/queue.js';
import {createShuffleCycle} from '../playlists/shuffle.js';
import {HelpPanel} from './help-panel.js';
import {Meter} from './meter.js';
import {
  PlaylistDetailPanel,
  type PlaylistDetailMode,
} from './playlist-detail-panel.js';
import {PlaylistPanel, type PlaylistDialog} from './playlist-panel.js';
import {PresetPanel} from './preset-panel.js';
import {QueuePanel} from './queue-panel.js';
import {SettingsPanel} from './settings-panel.js';

interface AppProps {
  source: CaptureSource;
  options: AppOptions;
  presets: Preset[];
  visualizer: VisualizerController;
  commandBus: ControlCommandBus;
  controlServer?: LocalControlServer;
  telegramEnabled?: boolean;
  initialSettings: UserSettings;
  saveSettings(settings: UserSettings): Promise<void>;
}

const BANDS: BandName[] = ['bass', 'mids', 'treble'];
const HISTORY_LENGTH = 120;

function nextInList<T>(items: readonly T[], current: T, direction: 1 | -1): T {
  const currentIndex = Math.max(0, items.indexOf(current));
  return items[(currentIndex + direction + items.length) % items.length] ?? current;
}

export function App({
  source,
  options,
  presets,
  visualizer,
  commandBus,
  controlServer,
  telegramEnabled = false,
  initialSettings,
  saveSettings,
}: AppProps): React.JSX.Element {
  const {exit} = useApp();
  const {columns, rows} = useWindowSize();
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
  const [smoothing, setSmoothing] = useState<SmoothingProfile>(initialSettings.smoothing);
  const [meterFloor, setMeterFloor] = useState(options.meterFloor);
  const [uiFps, setUiFps] = useState(options.uiFps);
  const [showHistory, setShowHistory] = useState(initialSettings.showHistory);
  const [visualizerSettings, setVisualizerSettings] = useState<VisualizerSettings>(
    options.visualizerSettings,
  );
  const [displays, setDisplays] = useState<VisualizerDisplay[]>([]);
  const [selectedDisplayIndex, setSelectedDisplayIndex] = useState(0);
  const [fullscreenOutput, setFullscreenOutput] = useState(false);
  const [panel, setPanel] = useState<
    'none' | 'settings' | 'help' | 'presets' | 'playlists' | 'playlist-detail'
  >('none');
  const [selectedRow, setSelectedRow] = useState(0);
  const [presetQuery, setPresetQuery] = useState('');
  const [presetTagFilter, setPresetTagFilter] = useState<PresetTagFilter>(
    initialSettings.presetTagFilter,
  );
  const [presetIndex, setPresetIndex] = useState(0);
  const [customPlaylists, setCustomPlaylists] = useState<CustomPlaylist[]>(
    initialSettings.customPlaylists,
  );
  const [activePlaylistId, setActivePlaylistId] = useState(
    initialSettings.selectedPlaylistId,
  );
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [playlistDialog, setPlaylistDialog] = useState<PlaylistDialog>({type: 'browse'});
  const [detailPlaylistId, setDetailPlaylistId] = useState<string>();
  const [playlistDetailMode, setPlaylistDetailMode] =
    useState<PlaylistDetailMode>('contents');
  const [playlistDetailIndex, setPlaylistDetailIndex] = useState(0);
  const [playlistCatalogQuery, setPlaylistCatalogQuery] = useState('');
  const [playlistCatalogTagFilter, setPlaylistCatalogTagFilter] =
    useState<PresetTagFilter>('all');
  const [playlistCatalogIndex, setPlaylistCatalogIndex] = useState(0);
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(
    initialSettings.autoSwitchEnabled,
  );
  const [autoSwitchSeconds, setAutoSwitchSeconds] = useState(
    initialSettings.autoSwitchSeconds,
  );
  const [autoSwitchRemaining, setAutoSwitchRemaining] = useState(
    initialSettings.autoSwitchEnabled ? initialSettings.autoSwitchSeconds : 0,
  );
  const [shuffleEnabled, setShuffleEnabled] = useState(initialSettings.shuffleEnabled);
  const [shuffleUpcomingIds, setShuffleUpcomingIds] = useState<string[]>([]);
  const [settingsError, setSettingsError] = useState<string>();
  const [currentPreset, setCurrentPreset] = useState<Preset>();
  const [visualizerStatus, setVisualizerStatus] = useState<VisualizerStatus>(
    visualizer.initialStatus,
  );

  const pausedRef = useRef(paused);
  const smoothingRef = useRef(smoothing);
  const meterFloorRef = useRef(meterFloor);
  const uiFpsRef = useRef(uiFps);
  const panelRef = useRef(panel);
  const showHistoryRef = useRef(showHistory);
  const hasSignalRef = useRef(false);
  const lastUiFrameAtRef = useRef(0);
  const dbRef = useRef<BandValues>({bass: -Infinity, mids: -Infinity, treble: -Infinity});
  const levelsRef = useRef<BandValues>(EMPTY_BANDS);
  const shuffleUpcomingRef = useRef<string[]>([]);
  const shuffleHistoryRef = useRef<string[]>([]);
  const autoSwitchRemainingMsRef = useRef(
    initialSettings.autoSwitchSeconds * 1000,
  );
  const controlCommandRef = useRef<(command: ControlCommand) => void>(() => undefined);
  pausedRef.current = paused;
  smoothingRef.current = smoothing;
  meterFloorRef.current = meterFloor;
  uiFpsRef.current = uiFps;
  panelRef.current = panel;
  showHistoryRef.current = showHistory;

  const playlists = useMemo(
    () => buildPlaylists(presets, customPlaylists),
    [presets, customPlaylists],
  );
  const activePlaylist =
    playlists.find(playlist => playlist.id === activePlaylistId) ??
    playlists.find(playlist => playlist.id === DEFAULT_PLAYLIST_ID) ??
    playlists[0];
  const presetById = useMemo(
    () => new Map(presets.map(preset => [preset.id, preset])),
    [presets],
  );
  const activePresets = useMemo(
    () =>
      (activePlaylist?.presetIds ?? [])
        .map(id => presetById.get(id))
        .filter((preset): preset is Preset => Boolean(preset)),
    [activePlaylist, presetById],
  );
  const activePresetSignature = useMemo(
    () => activePresets.map(preset => preset.id).join('\u0000'),
    [activePresets],
  );
  const shuffleUpcomingPresets = useMemo(
    () =>
      shuffleUpcomingIds
        .map(id => presetById.get(id))
        .filter((preset): preset is Preset => Boolean(preset)),
    [presetById, shuffleUpcomingIds],
  );
  const controlQueue = useMemo(
    () => buildPresetQueue(activePresets, currentPreset, 5),
    [activePresets, currentPreset],
  );

  const replaceShuffleUpcoming = (ids: string[]): void => {
    shuffleUpcomingRef.current = ids;
    setShuffleUpcomingIds(ids);
  };

  useEffect(() => {
    void source
      .start({
        onDevices: setDevices,
        onInfo: setInfo,
        onStatus: setStatus,
        onFrame: frame => {
          if (pausedRef.current) return;
          if (frame.hasSignal !== hasSignalRef.current) {
            hasSignalRef.current = frame.hasSignal;
            setHasSignal(frame.hasSignal);
          }
          const next = {...levelsRef.current};
          for (const band of BANDS) {
            next[band] = smoothLevel(
              levelsRef.current[band],
              dbToLevel(frame.db[band], meterFloorRef.current),
              smoothingRef.current,
            );
          }
          levelsRef.current = next;
          dbRef.current = frame.db;
          const minimumInterval = 1000 / uiFpsRef.current;
          if (frame.timestamp - lastUiFrameAtRef.current < minimumInterval) return;
          lastUiFrameAtRef.current = frame.timestamp;
          controlServer?.updateAudioFrame(
            next,
            {
              bass: Number.isFinite(frame.db.bass) ? frame.db.bass : null,
              mids: Number.isFinite(frame.db.mids) ? frame.db.mids : null,
              treble: Number.isFinite(frame.db.treble) ? frame.db.treble : null,
            },
            frame.hasSignal,
          );
          if (panelRef.current !== 'none') return;
          setDb(frame.db);
          setLevels(next);
          if (showHistoryRef.current) {
            setHistory(previousHistory => ({
              bass: [...previousHistory.bass, next.bass].slice(-HISTORY_LENGTH),
              mids: [...previousHistory.mids, next.mids].slice(-HISTORY_LENGTH),
              treble: [...previousHistory.treble, next.treble].slice(-HISTORY_LENGTH),
            }));
          }
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
  }, [controlServer, source]);

  useEffect(() => visualizer.subscribe(setVisualizerStatus), [visualizer]);

  useEffect(() => {
    let active = true;
    void visualizer.listDisplays().then(nextDisplays => {
      if (!active) return;
      setDisplays(nextDisplays);
      const savedIndex = nextDisplays.findIndex(
        display => display.id === initialSettings.selectedDisplayId,
      );
      const selectedIndex =
        savedIndex >= 0
          ? savedIndex
          : Math.max(0, nextDisplays.findIndex(display => display.isPrimary));
      setSelectedDisplayIndex(selectedIndex);
      const selectedDisplay = nextDisplays[selectedIndex];
      if (selectedDisplay) void visualizer.setFullscreen(false, selectedDisplay);
    });
    return () => {
      active = false;
    };
  }, [initialSettings.selectedDisplayId, visualizer]);

  useEffect(() => {
    if (info?.deviceId) void visualizer.selectAudioDevice(info.deviceId, info.deviceName);
  }, [info?.deviceId, info?.deviceName, visualizer]);

  useEffect(
    () => () => {
      void visualizer.stop();
    },
    [visualizer],
  );

  useEffect(() => {
    if (activePlaylist?.id !== activePlaylistId && activePlaylist) {
      setActivePlaylistId(activePlaylist.id);
    }
  }, [activePlaylist, activePlaylistId]);

  useEffect(() => {
    shuffleHistoryRef.current = [];
    if (!shuffleEnabled) {
      shuffleUpcomingRef.current = [];
      setShuffleUpcomingIds([]);
      return;
    }

    const ids = activePresets.map(preset => preset.id);
    const currentIsInPlaylist = ids.includes(currentPreset?.id ?? '');
    const candidates = currentIsInPlaylist
      ? ids.filter(id => id !== currentPreset?.id)
      : ids;
    const cycle =
      candidates.length > 0
        ? createShuffleCycle(candidates)
        : createShuffleCycle(ids, currentPreset?.id);
    shuffleUpcomingRef.current = cycle;
    setShuffleUpcomingIds(cycle);
  }, [activePlaylist?.id, activePresetSignature, shuffleEnabled]);

  useEffect(() => {
    const selectedDisplay = displays[selectedDisplayIndex];
    void saveSettings({
      version: 1,
      ...(options.nestDropDirectory
        ? {nestDropDirectory: options.nestDropDirectory}
        : {}),
      ...(info?.deviceId || options.deviceId
        ? {deviceId: info?.deviceId ?? options.deviceId}
        : {}),
      smoothing,
      uiFps,
      meterFloor,
      showHistory,
      visualizerSettings,
      ...(selectedDisplay || initialSettings.selectedDisplayId
        ? {selectedDisplayId: selectedDisplay?.id ?? initialSettings.selectedDisplayId}
        : {}),
      selectedPlaylistId: activePlaylist?.id ?? DEFAULT_PLAYLIST_ID,
      presetTagFilter,
      customPlaylists,
      autoSwitchEnabled,
      autoSwitchSeconds,
      shuffleEnabled,
    })
      .then(() => setSettingsError(undefined))
      .catch(error =>
        setSettingsError(
          `Sauvegarde impossible: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  }, [
    activePlaylist?.id,
    autoSwitchEnabled,
    autoSwitchSeconds,
    customPlaylists,
    displays,
    info?.deviceId,
    initialSettings.selectedDisplayId,
    meterFloor,
    options.deviceId,
    options.nestDropDirectory,
    presetTagFilter,
    saveSettings,
    selectedDisplayIndex,
    showHistory,
    smoothing,
    uiFps,
    shuffleEnabled,
    visualizerSettings,
  ]);

  const filteredPresets = useMemo(() => {
    const normalizedQuery = presetQuery.trim().toLocaleLowerCase();
    return presets.filter(
      preset =>
        (presetTagFilter === 'all' || preset.tags.includes(presetTagFilter)) &&
        (normalizedQuery.length === 0 ||
          preset.relativePath.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [presets, presetQuery, presetTagFilter]);

  const detailPlaylist = playlists.find(playlist => playlist.id === detailPlaylistId);
  const detailPresets = useMemo(
    () =>
      (detailPlaylist?.presetIds ?? [])
        .map(id => presetById.get(id))
        .filter((preset): preset is Preset => Boolean(preset)),
    [detailPlaylist, presetById],
  );
  const filteredCatalogPresets = useMemo(() => {
    const normalizedQuery = playlistCatalogQuery.trim().toLocaleLowerCase();
    return presets.filter(
      preset =>
        (playlistCatalogTagFilter === 'all' ||
          preset.tags.includes(playlistCatalogTagFilter)) &&
        (normalizedQuery.length === 0 ||
          preset.relativePath.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [playlistCatalogQuery, playlistCatalogTagFilter, presets]);

  const showPreset = (preset: Preset, closePanel = true): void => {
    if (shuffleEnabled && activePresets.some(item => item.id === preset.id)) {
      let remaining = shuffleUpcomingRef.current.filter(id => id !== preset.id);
      if (remaining.length === 0 && activePresets.length > 0) {
        remaining = createShuffleCycle(
          activePresets.map(item => item.id),
          preset.id,
        );
      }
      replaceShuffleUpcoming(remaining);
    }
    setCurrentPreset(preset);
    if (closePanel) setPanel('none');
    void visualizer.showPreset(preset);
  };

  const cycleShuffledPreset = (closePanel: boolean): void => {
    if (activePresets.length === 0) return;
    const availableIds = new Set(activePresets.map(preset => preset.id));
    let remaining = shuffleUpcomingRef.current.filter(id => availableIds.has(id));
    if (remaining.length === 0) {
      remaining = createShuffleCycle(
        activePresets.map(preset => preset.id),
        currentPreset?.id,
      );
    }
    const nextId = remaining.shift();
    if (
      currentPreset &&
      availableIds.has(currentPreset.id) &&
      currentPreset.id !== nextId
    ) {
      shuffleHistoryRef.current = [
        ...shuffleHistoryRef.current.slice(-199),
        currentPreset.id,
      ];
    }
    replaceShuffleUpcoming(remaining);
    const preset = nextId ? presetById.get(nextId) : undefined;
    if (preset) showPreset(preset, closePanel);
  };

  const cyclePreset = (direction: 1 | -1): void => {
    if (activePresets.length === 0) return;
    if (shuffleEnabled && direction === 1) {
      cycleShuffledPreset(true);
      return;
    }
    if (shuffleEnabled && direction === -1) {
      const previousId = shuffleHistoryRef.current.pop();
      const previous = previousId ? presetById.get(previousId) : undefined;
      if (previous) {
        if (currentPreset && activePresets.some(preset => preset.id === currentPreset.id)) {
          replaceShuffleUpcoming([
            currentPreset.id,
            ...shuffleUpcomingRef.current.filter(id => id !== currentPreset.id),
          ]);
        }
        showPreset(previous);
        return;
      }
    }

    const currentIndex = activePresets.findIndex(preset => preset.id === currentPreset?.id);
    const targetIndex =
      currentIndex < 0
        ? direction === 1
          ? 0
          : activePresets.length - 1
        : (currentIndex + direction + activePresets.length) % activePresets.length;
    const preset = activePresets[targetIndex];
    if (preset) showPreset(preset);
  };

  const cycleAutomaticPreset = (): void => {
    if (activePresets.length === 0) return;
    if (shuffleEnabled) {
      cycleShuffledPreset(false);
      return;
    }
    const preset = nextSequentialPreset(activePresets, currentPreset);
    if (preset) showPreset(preset, false);
  };

  useEffect(() => {
    const duration = autoSwitchSeconds * 1000;
    autoSwitchRemainingMsRef.current = duration;
    setAutoSwitchRemaining(
      autoSwitchEnabled && activePresets.length > 0 ? autoSwitchSeconds : 0,
    );
  }, [
    activePlaylist?.id,
    activePresetSignature,
    autoSwitchEnabled,
    autoSwitchSeconds,
    currentPreset?.id,
    shuffleEnabled,
  ]);

  useEffect(() => {
    if (
      !autoSwitchEnabled ||
      activePresets.length === 0 ||
      !hasSignal ||
      paused
    ) return;

    let previousTick = Date.now();
    const ticker = setInterval(() => {
      const now = Date.now();
      autoSwitchRemainingMsRef.current = advanceAutoSwitchCountdown(
        autoSwitchRemainingMsRef.current,
        now - previousTick,
        true,
      );
      previousTick = now;
      setAutoSwitchRemaining(autoSwitchRemainingMsRef.current / 1000);
      if (autoSwitchRemainingMsRef.current <= 0) {
        clearInterval(ticker);
        autoSwitchRemainingMsRef.current = autoSwitchSeconds * 1000;
        setAutoSwitchRemaining(autoSwitchSeconds);
        cycleAutomaticPreset();
      }
    }, 250);
    return () => clearInterval(ticker);
  }, [
    activePlaylist?.id,
    activePresetSignature,
    autoSwitchEnabled,
    autoSwitchSeconds,
    currentPreset?.id,
    hasSignal,
    paused,
    shuffleEnabled,
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

  const cycleDisplay = (direction: 1 | -1): void => {
    if (displays.length < 2) return;
    setSelectedDisplayIndex(current => {
      const next = (current + direction + displays.length) % displays.length;
      void visualizer.setFullscreen(fullscreenOutput, displays[next]);
      return next;
    });
  };

  const toggleFullscreenOutput = (): void => {
    const display = displays[selectedDisplayIndex];
    if (!display) return;
    setFullscreenOutput(current => {
      const next = !current;
      void visualizer.setFullscreen(next, display);
      return next;
    });
  };

  const setRendererRunning = (enabled: boolean): void => {
    const running =
      visualizerStatus.state === 'running' || visualizerStatus.state === 'starting';
    if (!enabled) {
      if (running) void visualizer.stop();
      return;
    }
    if (running) return;
    if (currentPreset) {
      void visualizer.showPreset(currentPreset);
      return;
    }
    const firstVisualPreset =
      activePresets.find(preset => !preset.relativePath.startsWith('! Transition')) ??
      activePresets[0];
    if (firstVisualPreset) showPreset(firstVisualPreset);
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
        setUiFps(current => nextInList(TERMINAL_FRAME_RATES, current, direction));
        break;
      case 5:
        changeVisualizerSetting('frameRate', VISUAL_FRAME_RATES, direction);
        break;
      case 6:
        changeVisualizerSetting('speed', ANIMATION_SPEEDS, direction);
        break;
      case 7:
        changeVisualizerSetting('audioGain', VISUAL_AUDIO_GAINS, direction);
        break;
      case 8:
        cycleDisplay(direction);
        break;
      case 9:
        toggleFullscreenOutput();
        break;
      case 10:
        setAutoSwitchEnabled(current => !current);
        break;
      case 11:
        setAutoSwitchSeconds(current =>
          nextInList(AUTO_SWITCH_INTERVALS, current, direction),
        );
        break;
      case 12:
        setShuffleEnabled(current => !current);
        break;
    }
  };

  const openPlaylistManager = (): void => {
    setPlaylistIndex(
      Math.max(0, playlists.findIndex(playlist => playlist.id === activePlaylist?.id)),
    );
    setPlaylistDialog({type: 'browse'});
    setPanel('playlists');
  };

  const openPlaylistDetail = (playlist: Playlist): void => {
    setDetailPlaylistId(playlist.id);
    setPlaylistDetailMode('contents');
    setPlaylistDetailIndex(0);
    setPlaylistCatalogQuery('');
    setPlaylistCatalogTagFilter('all');
    setPlaylistCatalogIndex(0);
    setPanel('playlist-detail');
  };

  const confirmPlaylistName = (): void => {
    if (playlistDialog.type !== 'name') return;
    const rawName = playlistDialog.value.trim();
    if (!rawName) return;

    if (playlistDialog.operation === 'rename') {
      const playlistId = playlistDialog.sourceIds[0];
      if (!playlistId) return;
      const name = uniquePlaylistName(
        rawName,
        playlists.filter(playlist => playlist.id !== playlistId),
      );
      setCustomPlaylists(current =>
        current.map(playlist => playlist.id === playlistId ? {...playlist, name} : playlist),
      );
      setPlaylistDialog({type: 'browse'});
      return;
    }

    const sources = playlistDialog.sourceIds
      .map(id => playlists.find(playlist => playlist.id === id))
      .filter((playlist): playlist is Playlist => Boolean(playlist));
    const presetIds =
      playlistDialog.operation === 'merge' && sources.length >= 2
        ? mergePresetIds(...sources)
        : sources[0]?.presetIds ?? [];
    const playlist = createCustomPlaylist(
      uniquePlaylistName(rawName, playlists),
      presetIds,
    );
    setCustomPlaylists(current => [...current, playlist]);
    setActivePlaylistId(playlist.id);
    setPlaylistIndex(playlists.length);
    setPresetTagFilter('all');
    setPlaylistDialog({type: 'browse'});
    openPlaylistDetail({...playlist, readonly: false});
  };

  const deletePlaylist = (playlistId: string): void => {
    setCustomPlaylists(current => current.filter(playlist => playlist.id !== playlistId));
    if (activePlaylistId === playlistId) setActivePlaylistId(DEFAULT_PLAYLIST_ID);
    setPlaylistIndex(index => Math.max(0, Math.min(index, playlists.length - 2)));
    setPlaylistDialog({type: 'browse'});
  };

  const addCustomPlaylist = (name: string, presetIds: string[] = []): void => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const playlist = createCustomPlaylist(
      uniquePlaylistName(trimmedName, playlists),
      presetIds,
    );
    setCustomPlaylists(current => [...current, playlist]);
    setActivePlaylistId(playlist.id);
    setPresetTagFilter('all');
  };

  const togglePresetInDetailPlaylist = (presetId: string): void => {
    if (!detailPlaylistId || detailPlaylist?.readonly) return;
    setCustomPlaylists(current =>
      current.map(playlist => {
        if (playlist.id !== detailPlaylistId) return playlist;
        return playlist.presetIds.includes(presetId)
          ? {...playlist, presetIds: playlist.presetIds.filter(id => id !== presetId)}
          : {...playlist, presetIds: [...playlist.presetIds, presetId]};
      }),
    );
  };

  controlCommandRef.current = command => {
    switch (command.type) {
      case 'set-paused':
        setPaused(Boolean(command.enabled));
        break;
      case 'set-renderer-running':
        setRendererRunning(Boolean(command.enabled));
        break;
      case 'set-fullscreen': {
        const display = displays[selectedDisplayIndex];
        if (!display) break;
        setFullscreenOutput(Boolean(command.enabled));
        void visualizer.setFullscreen(Boolean(command.enabled), display);
        break;
      }
      case 'cycle-preset':
        if (command.direction === 1 || command.direction === -1) {
          cyclePreset(command.direction);
        }
        break;
      case 'show-preset': {
        const preset = presetById.get(command.presetId);
        if (preset) showPreset(preset, false);
        break;
      }
      case 'set-device':
        if (devices.some(device => device.id === command.deviceId)) {
          void source.selectDevice(command.deviceId);
        }
        break;
      case 'set-display': {
        const index = displays.findIndex(display => display.id === command.displayId);
        const display = displays[index];
        if (!display) break;
        setSelectedDisplayIndex(index);
        void visualizer.setFullscreen(fullscreenOutput, display);
        break;
      }
      case 'set-smoothing':
        if (SMOOTHING_ORDER.includes(command.value)) setSmoothing(command.value);
        break;
      case 'set-meter-floor':
        if (METER_FLOORS.some(value => value === command.value)) {
          setMeterFloor(command.value);
        }
        break;
      case 'set-show-history':
        setShowHistory(Boolean(command.enabled));
        break;
      case 'set-ui-fps':
        if (TERMINAL_FRAME_RATES.some(value => value === command.value)) {
          setUiFps(command.value);
        }
        break;
      case 'set-visualizer-settings':
        setVisualizerSettings(current => {
          const requested = command.value;
          const next = {
            frameRate:
              Number.isInteger(requested.frameRate) &&
              requested.frameRate !== undefined &&
              requested.frameRate >= 10 &&
              requested.frameRate <= 120
                ? requested.frameRate
                : current.frameRate,
            speed:
              typeof requested.speed === 'number' &&
              Number.isFinite(requested.speed) &&
              requested.speed >= 0 &&
              requested.speed <= 2
                ? requested.speed
                : current.speed,
            audioGain:
              typeof requested.audioGain === 'number' &&
              Number.isFinite(requested.audioGain) &&
              requested.audioGain >= 0 &&
              requested.audioGain <= 1
                ? requested.audioGain
                : current.audioGain,
          };
          void visualizer.configure(next);
          return next;
        });
        break;
      case 'set-preset-tag-filter':
        if (PRESET_TAG_FILTERS.includes(command.value)) {
          setPresetTagFilter(command.value);
          setPresetIndex(0);
        }
        break;
      case 'set-active-playlist':
        if (playlists.some(playlist => playlist.id === command.playlistId)) {
          setActivePlaylistId(command.playlistId);
          setPresetTagFilter('all');
        }
        break;
      case 'set-auto-switch':
        setAutoSwitchEnabled(Boolean(command.enabled));
        break;
      case 'set-auto-seconds':
        if (
          Number.isFinite(command.value) &&
          command.value >= 1 &&
          command.value <= 3600
        ) setAutoSwitchSeconds(command.value);
        break;
      case 'set-shuffle':
        setShuffleEnabled(Boolean(command.enabled));
        break;
      case 'create-playlist':
        addCustomPlaylist(command.name);
        break;
      case 'copy-playlist': {
        const sourcePlaylist = playlists.find(
          playlist => playlist.id === command.sourceId,
        );
        if (sourcePlaylist) addCustomPlaylist(command.name, sourcePlaylist.presetIds);
        break;
      }
      case 'merge-playlists': {
        const sources = [...new Set(command.sourceIds)]
          .map(id => playlists.find(playlist => playlist.id === id))
          .filter((playlist): playlist is Playlist => Boolean(playlist));
        if (sources.length >= 2) {
          addCustomPlaylist(command.name, mergePresetIds(...sources));
        }
        break;
      }
      case 'rename-playlist': {
        const target = playlists.find(playlist => playlist.id === command.playlistId);
        if (!target || target.readonly || !command.name.trim()) break;
        const name = uniquePlaylistName(
          command.name,
          playlists.filter(playlist => playlist.id !== target.id),
        );
        setCustomPlaylists(current =>
          current.map(playlist => playlist.id === target.id ? {...playlist, name} : playlist),
        );
        break;
      }
      case 'delete-playlist': {
        const target = playlists.find(playlist => playlist.id === command.playlistId);
        if (target && !target.readonly) deletePlaylist(target.id);
        break;
      }
      case 'set-playlist-preset': {
        const target = playlists.find(playlist => playlist.id === command.playlistId);
        if (!target || target.readonly || !presetById.has(command.presetId)) break;
        setCustomPlaylists(current =>
          current.map(playlist => {
            if (playlist.id !== target.id) return playlist;
            const contains = playlist.presetIds.includes(command.presetId);
            if (command.included && !contains) {
              return {...playlist, presetIds: [...playlist.presetIds, command.presetId]};
            }
            if (!command.included && contains) {
              return {
                ...playlist,
                presetIds: playlist.presetIds.filter(id => id !== command.presetId),
              };
            }
            return playlist;
          }),
        );
        break;
      }
      case 'quit':
        void Promise.all([source.stop(), visualizer.stop()]).finally(exit);
        break;
    }
  };

  useEffect(
    () => commandBus.subscribe(command => controlCommandRef.current(command)),
    [commandBus],
  );

  useEffect(() => {
    controlServer?.updateCatalog({
      devices,
      displays,
      presets: presets.map(preset => ({
        id: preset.id,
        name: preset.name,
        relativePath: preset.relativePath,
        tags: preset.tags,
      })),
      playlists,
    });
  }, [controlServer, devices, displays, playlists, presets]);

  useEffect(() => {
    const latestDb = dbRef.current;
    controlServer?.updateState({
      audio: {
        state: status.state,
        message: status.message,
        ...(info?.deviceId ? {deviceId: info.deviceId} : {}),
        ...(info?.deviceName ? {deviceName: info.deviceName} : {}),
        hasSignal,
        paused,
        db: {
          bass: Number.isFinite(latestDb.bass) ? latestDb.bass : null,
          mids: Number.isFinite(latestDb.mids) ? latestDb.mids : null,
          treble: Number.isFinite(latestDb.treble) ? latestDb.treble : null,
        },
        levels: levelsRef.current,
      },
      visualizer: {
        state: visualizerStatus.state,
        message: visualizerStatus.message,
        running:
          visualizerStatus.state === 'running' || visualizerStatus.state === 'starting',
        fullscreen: fullscreenOutput,
        ...(displays[selectedDisplayIndex]
          ? {selectedDisplayId: displays[selectedDisplayIndex]?.id}
          : {}),
      },
      ...(currentPreset ? {currentPresetId: currentPreset.id} : {}),
      ...(activePlaylist ? {activePlaylistId: activePlaylist.id} : {}),
      queue: {
        ...(controlQueue.priority ? {priorityId: controlQueue.priority.id} : {}),
        ...(controlQueue.current ? {currentId: controlQueue.current.id} : {}),
        upcomingIds: (shuffleEnabled
          ? shuffleUpcomingPresets.slice(0, 5)
          : controlQueue.upcoming
        ).map(preset => preset.id),
      },
      settings: {
        smoothing,
        meterFloor,
        showHistory,
        uiFps,
        visualizer: visualizerSettings,
        presetTagFilter,
        autoSwitchEnabled,
        autoSwitchSeconds,
        autoSwitchRemaining,
        shuffleEnabled,
      },
    });
  }, [
    activePlaylist,
    autoSwitchEnabled,
    autoSwitchRemaining,
    autoSwitchSeconds,
    controlQueue,
    controlServer,
    currentPreset,
    db,
    displays,
    fullscreenOutput,
    hasSignal,
    info,
    levels,
    meterFloor,
    paused,
    presetTagFilter,
    selectedDisplayIndex,
    showHistory,
    shuffleEnabled,
    shuffleUpcomingPresets,
    smoothing,
    status,
    uiFps,
    visualizerSettings,
    visualizerStatus,
  ]);

  useInput((input, key) => {
    if (panel === 'playlist-detail') {
      if (!detailPlaylist) {
        setPanel('playlists');
        return;
      }

      if (playlistDetailMode === 'contents') {
        if (key.escape) {
          setPlaylistIndex(
            Math.max(0, playlists.findIndex(playlist => playlist.id === detailPlaylist.id)),
          );
          setPanel('playlists');
        } else if (key.tab && !detailPlaylist.readonly) {
          setPlaylistDetailMode('catalog');
          setPlaylistCatalogIndex(0);
        } else if (key.upArrow) {
          setPlaylistDetailIndex(index => Math.max(0, index - 1));
        } else if (key.downArrow) {
          setPlaylistDetailIndex(index =>
            Math.min(Math.max(0, detailPresets.length - 1), index + 1),
          );
        } else if (key.pageUp) {
          setPlaylistDetailIndex(index => Math.max(0, index - 8));
        } else if (key.pageDown) {
          setPlaylistDetailIndex(index =>
            Math.min(Math.max(0, detailPresets.length - 1), index + 8),
          );
        } else if (key.return) {
          const preset = detailPresets[playlistDetailIndex];
          if (preset) showPreset(preset);
        } else if (input.toLowerCase() === 'a') {
          setActivePlaylistId(detailPlaylist.id);
          setPresetTagFilter('all');
        } else if (input.toLowerCase() === 'x' && !detailPlaylist.readonly) {
          const preset = detailPresets[playlistDetailIndex];
          if (preset) {
            togglePresetInDetailPlaylist(preset.id);
            setPlaylistDetailIndex(index =>
              Math.max(0, Math.min(index, detailPresets.length - 2)),
            );
          }
        }
      } else if (key.escape || key.tab) {
        setPlaylistDetailMode('contents');
        setPlaylistDetailIndex(0);
      } else if (key.leftArrow || key.rightArrow) {
        setPlaylistCatalogTagFilter(current =>
          nextInList(PRESET_TAG_FILTERS, current, key.leftArrow ? -1 : 1),
        );
        setPlaylistCatalogIndex(0);
      } else if (key.upArrow) {
        setPlaylistCatalogIndex(index => Math.max(0, index - 1));
      } else if (key.downArrow) {
        setPlaylistCatalogIndex(index =>
          Math.min(Math.max(0, filteredCatalogPresets.length - 1), index + 1),
        );
      } else if (key.pageUp) {
        setPlaylistCatalogIndex(index => Math.max(0, index - 8));
      } else if (key.pageDown) {
        setPlaylistCatalogIndex(index =>
          Math.min(Math.max(0, filteredCatalogPresets.length - 1), index + 8),
        );
      } else if (key.return) {
        const preset = filteredCatalogPresets[playlistCatalogIndex];
        if (preset) togglePresetInDetailPlaylist(preset.id);
      } else if (key.backspace || key.delete) {
        setPlaylistCatalogQuery(query => query.slice(0, -1));
        setPlaylistCatalogIndex(0);
      } else if (!key.ctrl && !key.meta && input && !/\p{C}/u.test(input)) {
        setPlaylistCatalogQuery(query => query + input);
        setPlaylistCatalogIndex(0);
      }
      return;
    }

    if (panel === 'playlists') {
      const selected = playlists[playlistIndex];
      if (playlistDialog.type === 'name') {
        if (key.escape) setPlaylistDialog({type: 'browse'});
        else if (key.return) confirmPlaylistName();
        else if (key.backspace || key.delete) {
          setPlaylistDialog(dialog =>
            dialog.type === 'name' ? {...dialog, value: dialog.value.slice(0, -1)} : dialog,
          );
        } else if (!key.ctrl && !key.meta && input && !/\p{C}/u.test(input)) {
          setPlaylistDialog(dialog =>
            dialog.type === 'name' ? {...dialog, value: dialog.value + input} : dialog,
          );
        }
        return;
      }
      if (playlistDialog.type === 'delete') {
        if (input.toLowerCase() === 'y') deletePlaylist(playlistDialog.playlistId);
        else if (key.escape || input.toLowerCase() === 'n') {
          setPlaylistDialog({type: 'browse'});
        }
        return;
      }
      if (playlistDialog.type === 'merge') {
        if (key.escape) setPlaylistDialog({type: 'browse'});
        else if (key.upArrow) setPlaylistIndex(index => Math.max(0, index - 1));
        else if (key.downArrow) {
          setPlaylistIndex(index => Math.min(playlists.length - 1, index + 1));
        } else if (input === ' ' && selected) {
          setPlaylistDialog(dialog => {
            if (dialog.type !== 'merge') return dialog;
            const selectedIds = dialog.selectedIds.includes(selected.id)
              ? dialog.selectedIds.filter(id => id !== selected.id)
              : [...dialog.selectedIds, selected.id];
            return {...dialog, selectedIds};
          });
        } else if (key.return && playlistDialog.selectedIds.length >= 2) {
          const selectedPlaylists = playlistDialog.selectedIds
            .map(id => playlists.find(playlist => playlist.id === id))
            .filter((playlist): playlist is Playlist => Boolean(playlist));
          setPlaylistDialog({
            type: 'name',
            operation: 'merge',
            sourceIds: playlistDialog.selectedIds,
            value:
              selectedPlaylists.length === 2
                ? selectedPlaylists.map(playlist => playlist.name).join(' + ')
                : `Fusion ${selectedPlaylists.length} playlists`,
          });
        }
        return;
      }

      if (key.escape || input.toLowerCase() === 'l') setPanel('none');
      else if (key.upArrow) setPlaylistIndex(index => Math.max(0, index - 1));
      else if (key.downArrow) {
        setPlaylistIndex(index => Math.min(playlists.length - 1, index + 1));
      } else if (key.return && selected) {
        openPlaylistDetail(selected);
      } else if (input.toLowerCase() === 'a' && selected) {
        setActivePlaylistId(selected.id);
        setPresetTagFilter('all');
      } else if (input.toLowerCase() === 'n') {
        setPlaylistDialog({type: 'name', operation: 'new', sourceIds: [], value: ''});
      } else if (input.toLowerCase() === 'c' && selected) {
        setPlaylistDialog({
          type: 'name',
          operation: 'copy',
          sourceIds: [selected.id],
          value: `${selected.name} (copie)`,
        });
      } else if (input.toLowerCase() === 'm' && selected) {
        setPlaylistDialog({type: 'merge', selectedIds: [selected.id]});
      } else if (input.toLowerCase() === 'r' && selected && !selected.readonly) {
        setPlaylistDialog({
          type: 'name',
          operation: 'rename',
          sourceIds: [selected.id],
          value: selected.name,
        });
      } else if (input.toLowerCase() === 'd' && selected && !selected.readonly) {
        setPlaylistDialog({type: 'delete', playlistId: selected.id});
      }
      return;
    }

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
      else if (key.downArrow) setSelectedRow(row => Math.min(12, row + 1));
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
    else if (input.toLowerCase() === 't') {
      setAutoSwitchEnabled(current => !current);
    } else if (input.toLowerCase() === 'l') openPlaylistManager();
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
      setRendererRunning(
        visualizerStatus.state !== 'running' && visualizerStatus.state !== 'starting',
      );
    } else if (input.toLowerCase() === 'n') cyclePreset(1);
    else if (input.toLowerCase() === 'b') cyclePreset(-1);
    else if (input.toLowerCase() === 'd') cycleDevice(1);
    else if (input.toLowerCase() === 's') cycleSmoothing(1);
    else if (input.toLowerCase() === 'f') toggleFullscreenOutput();
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
  const compact = rows < 32;
  const integrationLabel = [
    controlServer ? `WEB ${controlServer.url}` : undefined,
    telegramEnabled ? 'TELEGRAM' : undefined,
  ].filter((value): value is string => Boolean(value)).join(' · ');
  const header = (
    <Box justifyContent="space-between">
      <Text bold color="cyan">
        TEOLEEVO{' '}
        <Text dimColor>
          {integrationLabel ? `// ${integrationLabel}` : '// LIVE AUDIO SPECTRUM'}
        </Text>
      </Text>
      <Text color={statusColor}>
        {statusDot} {statusLabel}
      </Text>
    </Box>
  );
  const errors = (
    <>
      {status.state === 'error' ? (
        <Box borderStyle="single" borderColor="red" paddingX={1} marginBottom={1}>
          <Text color="red">{status.message}</Text>
        </Box>
      ) : null}
      {settingsError ? (
        <Box borderStyle="single" borderColor="red" paddingX={1} marginBottom={1}>
          <Text color="red">{settingsError}</Text>
        </Box>
      ) : null}
    </>
  );
  const panelContent =
    panel === 'settings' ? (
      <SettingsPanel
        devices={devices}
        selectedDeviceId={info?.deviceId}
        smoothing={smoothing}
        meterFloor={meterFloor}
        uiFps={uiFps}
        showHistory={showHistory}
        displays={displays}
        selectedDisplayIndex={selectedDisplayIndex}
        fullscreenOutput={fullscreenOutput}
        visualizerSettings={visualizerSettings}
        autoSwitchEnabled={autoSwitchEnabled}
        autoSwitchSeconds={autoSwitchSeconds}
        shuffleEnabled={shuffleEnabled}
        selectedRow={selectedRow}
      />
    ) : panel === 'playlists' ? (
      <PlaylistPanel
        playlists={playlists}
        activePlaylistId={activePlaylist?.id ?? ''}
        selectedIndex={playlistIndex}
        dialog={playlistDialog}
      />
    ) : panel === 'playlist-detail' && detailPlaylist ? (
      <PlaylistDetailPanel
        playlist={detailPlaylist}
        presets={
          playlistDetailMode === 'contents' ? detailPresets : filteredCatalogPresets
        }
        mode={playlistDetailMode}
        query={playlistCatalogQuery}
        tagFilter={playlistCatalogTagFilter}
        selectedIndex={
          playlistDetailMode === 'contents'
            ? playlistDetailIndex
            : playlistCatalogIndex
        }
        currentPresetId={currentPreset?.id}
        active={detailPlaylist.id === activePlaylist?.id}
        compact={compact}
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
        compact={compact}
      />
    ) : null;

  if (panel !== 'none') {
    return (
      <Box flexDirection="column" paddingX={1} width={contentWidth}>
        {header}
        {errors}
        <Box marginTop={1}>{panelContent}</Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} width={contentWidth}>
      {header}

      {compact ? (
        <Box justifyContent="space-between" marginTop={1}>
          <Text wrap="truncate-end">
            <Text dimColor>Source </Text>
            {info?.deviceName ?? status.message}
          </Text>
          <Text color={hasSignal && !paused ? 'green' : 'gray'}>
            {hasSignal && !paused ? '● SIGNAL' : '○ SILENCE'}
          </Text>
        </Box>
      ) : (
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
      )}

      <Box flexDirection="column" marginTop={1}>
        {BANDS.map(band => (
          <Meter
            key={band}
            {...BAND_LABELS[band]}
            level={levels[band]}
            db={db[band]}
            history={history[band]}
            width={contentWidth}
            showHistory={showHistory && !compact}
            compact={compact}
          />
        ))}
      </Box>

      {compact ? (
        <Box justifyContent="space-between" marginTop={1}>
          <Text wrap="truncate-end">
            <Text dimColor>Preset </Text>
            {currentPreset?.name ?? 'Aucun preset sélectionné'}
          </Text>
          <Text color={visualizerColor}>
            {visualizerStatus.state === 'running'
              ? fullscreenOutput
                ? 'PLEIN ÉCRAN'
                : 'MOTEUR ACTIF'
              : `${activePresets.length} .MILK`}
          </Text>
        </Box>
      ) : (
        <Box borderStyle="round" borderColor={visualizerColor} paddingX={1} marginBottom={1}>
          <Box flexDirection="column" flexGrow={1}>
            <Text wrap="truncate-end">
              <Text dimColor>Preset </Text>
              {currentPreset?.name ?? 'Aucun preset sélectionné'}
            </Text>
            <Text wrap="truncate-end">
              <Text dimColor>Playlist </Text>
              {activePlaylist?.name ?? 'Aucune'} · {activePresets.length} preset(s)
            </Text>
            <Text dimColor wrap="truncate-end">
              {visualizerStatus.message}
            </Text>
          </Box>
          <Text color={visualizerColor}>
            {visualizerStatus.state === 'running'
              ? fullscreenOutput
                ? ' PLEIN ÉCRAN'
                : ' MOTEUR ACTIF'
              : ` ${activePresets.length} .MILK`}
          </Text>
        </Box>
      )}

      {errors}

      <Box flexDirection="column">
        <QueuePanel
          playlist={activePlaylist}
          presets={activePresets}
          currentPreset={currentPreset}
          upcomingOverride={shuffleEnabled ? shuffleUpcomingPresets : undefined}
          autoSwitchEnabled={autoSwitchEnabled}
          autoSwitchSeconds={autoSwitchSeconds}
          autoSwitchRemaining={autoSwitchRemaining}
          autoSwitchPaused={!hasSignal || paused}
          autoSwitchPauseReason={paused ? 'manual' : 'silence'}
          shuffleEnabled={shuffleEnabled}
          upcomingCount={compact ? 2 : 3}
        />
        {compact ? (
          <Text dimColor wrap="truncate-end">
            L playlists · P presets · N/B changer · V moteur · F plein écran · O options · Q quitter
          </Text>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor wrap="truncate-end">
              L playlists · P presets · N/B changer · V moteur · F plein écran
            </Text>
            <Box justifyContent="space-between">
              <Text dimColor>T auto · O options · H aide · Q quitter</Text>
              <Text dimColor>{SMOOTHING_PROFILES[smoothing].label} · {meterFloor} dB</Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
