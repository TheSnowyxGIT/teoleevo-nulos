import type {PresetTag} from '../types.js';

export const PRESET_TAG_FILTERS = [
  'all',
  'build-up',
  'drop',
  'verse',
  'other',
] as const;

export type PresetTagFilter = (typeof PRESET_TAG_FILTERS)[number];

export const PRESET_TAG_LABELS: Record<PresetTagFilter, string> = {
  all: 'TOUS',
  'build-up': 'BUILD-UP',
  drop: 'DROP',
  verse: 'VERSE',
  other: 'OTHER',
};

const CURATED_PRESETS: Record<Exclude<PresetTag, 'other'>, readonly string[]> = {
  'build-up': [
    'Tripgnosis - Flowerstrobe',
    'martin - hardcore mix 1 [meta mash]',
    'Syst3mFailur - satanic ring V2 nz+ --- Isosceles edit1',
    'suksma - log spec with phase diff - circle jerked obscure',
    'suksma + rovastar eos phat rediJedi adamfx - the future of oreos',
    '101',
    'Ft AdamFX Preset Pack - martin - glassball dance in the basal ganglion - cabbage craze with flacc',
    'yin - Beat Detective 007 demo',
    'amandio c - polar value [shader pimped]',
    'RLP + Geiss - Bass Zoom Redux (3 Layers Minefield - Light that up - strobelight style)',
    'suksma - elch zoke paeg volr',
    '$$$ Royal - Mashup (330)',
    'An Digital FX Edit 2 martin - girlie affairs Internal LightFX AdamFX h',
    '$$$ Royal - Mashup (378)',
  ],
  drop: [
    '101',
    'ORB - Wheel of time super dead christ fuck fire',
    'fed - slowfast 2-0 [acid tweak]',
    'Zylot - True Visionary (Go Further Back) - Serge - Mashpotato 1',
    'Fumbling_Foo, Martin, Orb, Flexi - Star Forge v7 (HAKAN mash-up) 2-55 [mixwithv6v1bass] remade7d [[pixel theme]] 0-4 v1 {storm of pixels}',
    '$$$ Royal - Mashup (386)',
    'cortex meat - mighty mend-it',
    'Syst3mFailur - satanic ring V2 nz+ --- Isosceles edit3',
    'cpe domains flacc - vs cpe rUnDr lip theistphas',
    '184 nz+ submission by the gothiq hate terror god in the end, after all the death and torture, you will discover no gain from it',
    'amandio c - polar value [shader pimped]',
    'RLP + Geiss - Bass Zoom Redux (3 Layers Minefield - Light that up - strobelight style)',
    'suksma - elch zoke paeg volr',
    'suksma - n6 - n777 - shf no, it is you vut vill kuenipharma',
    'fat cancer tour meant',
  ],
  verse: [
    'Tripgnosis - Kaleidestrobe 3',
    'Neon n HdFX Ft Artist Geiss - AdamFX - Martin n Flexi - Natural Lsd E',
    '$$$ Royal - Mashup (375)',
    "craving 'spinach man' action figures suppositoric nutrition - sanity through directed madness",
    'ORB - Waaa (LamersAss Remix 2)',
    'ORB - Waaa (LamersAss Remix 5)',
    'cortex meat - mighty mend-it',
    'shifter + Flexi - liquid circuitry from the oblivion hive rw6 roam2,3',
    'shifter - fuzzball 3d (glasses) false auralary2 irscqe',
    '$$$ Royal - Mashup (471)',
    'Serge + Jc - Neon Star Formation004',
    '$$$ Royal - Mashup (191)',
    'suksma - doubting the gods but with horrible logic',
  ],
};

function normalizePresetName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();
}

const curatedNames = new Map<string, PresetTag[]>();
for (const tag of ['build-up', 'drop', 'verse'] as const) {
  for (const name of CURATED_PRESETS[tag]) {
    const normalizedName = normalizePresetName(name);
    const tags = curatedNames.get(normalizedName) ?? [];
    if (!tags.includes(tag)) tags.push(tag);
    curatedNames.set(normalizedName, tags);
  }
}

export function tagsForPresetName(name: string): PresetTag[] {
  return curatedNames.get(normalizePresetName(name)) ?? ['other'];
}
