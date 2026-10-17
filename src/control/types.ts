import type {
  AudioDevice,
  BandValues,
  Playlist,
  PresetTag,
  SoundCue,
  SmoothingProfile,
  VisualizerDisplay,
  VisualizerSettings,
} from '../types.js';

export type PresetTagFilter = 'all' | PresetTag;

export interface ControlPreset {
  id: string;
  name: string;
  relativePath: string;
  tags: PresetTag[];
}

export interface ControlCatalog {
  devices: AudioDevice[];
  displays: VisualizerDisplay[];
  presets: ControlPreset[];
  playlists: Playlist[];
}

export interface ControlState {
  audio: {
    state: string;
    message: string;
    deviceId?: string;
    deviceName?: string;
    hasSignal: boolean;
    paused: boolean;
    db: Record<keyof BandValues, number | null>;
    levels: BandValues;
  };
  visualizer: {
    state: string;
    message: string;
    running: boolean;
    fullscreen: boolean;
    selectedDisplayId?: string;
  };
  currentPresetId?: string;
  activePlaylistId?: string;
  queue: {
    priorityId?: string;
    currentId?: string;
    upcomingIds: string[];
  };
  settings: {
    smoothing: SmoothingProfile;
    meterFloor: number;
    showHistory: boolean;
    uiFps: number;
    visualizer: VisualizerSettings;
    presetTagFilter: PresetTagFilter;
    autoSwitchEnabled: boolean;
    autoSwitchSeconds: number;
    autoSwitchRemaining: number;
    shuffleEnabled: boolean;
  };
}

export type ControlCommand =
  | {type: 'set-paused'; enabled: boolean}
  | {type: 'set-renderer-running'; enabled: boolean}
  | {type: 'set-fullscreen'; enabled: boolean}
  | {type: 'cycle-preset'; direction: 1 | -1}
  | {type: 'play-sound'; sound: SoundCue}
  | {type: 'show-preset'; presetId: string}
  | {type: 'set-device'; deviceId: string}
  | {type: 'set-display'; displayId: string}
  | {type: 'set-smoothing'; value: SmoothingProfile}
  | {type: 'set-meter-floor'; value: number}
  | {type: 'set-show-history'; enabled: boolean}
  | {type: 'set-ui-fps'; value: number}
  | {type: 'set-visualizer-settings'; value: Partial<VisualizerSettings>}
  | {type: 'set-preset-tag-filter'; value: PresetTagFilter}
  | {type: 'set-active-playlist'; playlistId: string}
  | {type: 'set-auto-switch'; enabled: boolean}
  | {type: 'set-auto-seconds'; value: number}
  | {type: 'set-shuffle'; enabled: boolean}
  | {type: 'create-playlist'; name: string}
  | {type: 'copy-playlist'; sourceId: string; name: string}
  | {type: 'merge-playlists'; sourceIds: string[]; name: string}
  | {type: 'rename-playlist'; playlistId: string; name: string}
  | {type: 'delete-playlist'; playlistId: string}
  | {
      type: 'set-playlist-preset';
      playlistId: string;
      presetId: string;
      included: boolean;
    }
  | {type: 'quit'};

