import {existsSync, readdirSync} from 'node:fs';
import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {isWsl, toLocalPath} from '../platform.js';
import type {Preset} from '../types.js';
import {tagsForPresetName} from './tags.js';

const NESTDROP_DIRECTORY_NAME = 'NestDropClassicV2x2';
const NESTDROP_PRESET_PATH = path.join(
  'Plugins',
  'Milkdrop2',
  'Presets',
);
const NESTDROP_TEXTURE_PATH = path.join('Plugins', 'Milkdrop2', 'Textures');
const NESTDROP_RENDERER_PATH = path.join('Plugins', 'NestDrop_SpoutSender.exe');

export interface NestDropInstallation {
  directory: string;
  presetDirectory: string;
  textureDirectory: string;
  rendererPath: string;
}

export function resolveNestDropInstallation(directory: string): NestDropInstallation {
  const root = path.resolve(toLocalPath(directory));
  const installation = {
    directory: root,
    presetDirectory: path.join(root, NESTDROP_PRESET_PATH),
    textureDirectory: path.join(root, NESTDROP_TEXTURE_PATH),
    rendererPath: path.join(root, NESTDROP_RENDERER_PATH),
  };
  const missing = [
    installation.presetDirectory,
    installation.textureDirectory,
    installation.rendererPath,
  ].filter(candidate => !existsSync(candidate));
  if (missing.length > 0) {
    throw new Error(
      `Installation NestDrop incomplète dans ${root}. Introuvable: ${missing.join(', ')}`,
    );
  }
  return installation;
}

export function findDefaultNestDropDirectory(): string | undefined {
  const configured = process.env['TEOLEEVO_NESTDROP_DIR'];
  if (configured) return path.resolve(toLocalPath(configured));

  if (process.platform === 'win32' && process.env['USERPROFILE']) {
    const candidate = path.join(
      process.env['USERPROFILE'],
      'Downloads',
      NESTDROP_DIRECTORY_NAME,
    );
    if (existsSync(candidate)) return candidate;
  }

  if (isWsl && existsSync('/mnt/c/Users')) {
    for (const entry of readdirSync('/mnt/c/Users', {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(
        '/mnt/c/Users',
        entry.name,
        'Downloads',
        NESTDROP_DIRECTORY_NAME,
      );
      if (existsSync(candidate)) return candidate;
    }
  }

  return undefined;
}

export function findDefaultPresetDirectory(): string | undefined {
  const configured = process.env['TEOLEEVO_PRESET_DIR'];
  if (configured) {
    const localPath = path.resolve(toLocalPath(configured));
    if (existsSync(localPath)) return localPath;
  }

  if (process.platform === 'win32' && process.env['USERPROFILE']) {
    const candidate = path.join(
      process.env['USERPROFILE'],
      'Downloads',
      NESTDROP_DIRECTORY_NAME,
      NESTDROP_PRESET_PATH,
    );
    if (existsSync(candidate)) return candidate;
  }

  if (isWsl && existsSync('/mnt/c/Users')) {
    for (const entry of readdirSync('/mnt/c/Users', {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(
        '/mnt/c/Users',
        entry.name,
        'Downloads',
        NESTDROP_DIRECTORY_NAME,
        NESTDROP_PRESET_PATH,
      );
      if (existsSync(candidate)) return candidate;
    }
  }

  return undefined;
}

export function inferTextureDirectory(presetDirectory: string): string | undefined {
  const candidate = path.join(path.dirname(presetDirectory), 'Textures');
  return existsSync(candidate) ? candidate : undefined;
}

export async function scanPresets(directory: string): Promise<Preset[]> {
  const root = path.resolve(toLocalPath(directory));
  if (!existsSync(root)) {
    throw new Error(`Dossier de presets introuvable: ${root}`);
  }

  const presets: Preset[] = [];

  async function visit(currentDirectory: string): Promise<void> {
    const entries = await readdir(currentDirectory, {withFileTypes: true});
    await Promise.all(
      entries.map(async entry => {
        const absolutePath = path.join(currentDirectory, entry.name);
        if (entry.isDirectory()) {
          await visit(absolutePath);
        } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.milk') {
          const relativePath = path.relative(root, absolutePath);
          const name = path.basename(entry.name, path.extname(entry.name));
          presets.push({
            id: relativePath,
            name,
            path: absolutePath,
            relativePath,
            tags: tagsForPresetName(name),
          });
        }
      }),
    );
  }

  await visit(root);
  return presets.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, undefined, {sensitivity: 'base'}),
  );
}
