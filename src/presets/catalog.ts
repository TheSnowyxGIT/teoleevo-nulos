import {existsSync, readdirSync} from 'node:fs';
import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {isWsl, toLocalPath} from '../platform.js';
import type {Preset} from '../types.js';

const NESTDROP_PRESET_SUFFIX = path.join(
  'Downloads',
  'NestDropClassicV2x2',
  'Plugins',
  'Milkdrop2',
  'Presets',
);

export function findDefaultPresetDirectory(): string | undefined {
  const configured = process.env['TEOLEEVO_PRESET_DIR'];
  if (configured) {
    const localPath = path.resolve(toLocalPath(configured));
    if (existsSync(localPath)) return localPath;
  }

  if (process.platform === 'win32' && process.env['USERPROFILE']) {
    const candidate = path.join(process.env['USERPROFILE'], NESTDROP_PRESET_SUFFIX);
    if (existsSync(candidate)) return candidate;
  }

  if (isWsl && existsSync('/mnt/c/Users')) {
    for (const entry of readdirSync('/mnt/c/Users', {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join('/mnt/c/Users', entry.name, NESTDROP_PRESET_SUFFIX);
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
          presets.push({
            id: relativePath,
            name: path.basename(entry.name, path.extname(entry.name)),
            path: absolutePath,
            relativePath,
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
