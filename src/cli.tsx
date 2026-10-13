#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {parseCli, HELP_TEXT} from './cli-options.js';
import {createCapture} from './audio/create-capture.js';
import {
  findDefaultPresetDirectory,
  inferTextureDirectory,
  scanPresets,
} from './presets/catalog.js';
import {App} from './ui/app.js';
import {createVisualizer} from './visualizer/create-visualizer.js';

async function main(): Promise<void> {
  try {
    const {options, help} = parseCli(process.argv.slice(2));
    if (help) {
      process.stdout.write(HELP_TEXT.trimStart());
      return;
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('Teoleevo doit être lancé dans un terminal interactif.');
    }

    const presetDirectory = options.presetDirectory ?? findDefaultPresetDirectory();
    const presets = presetDirectory ? await scanPresets(presetDirectory) : [];
    options.presetDirectory = presetDirectory;
    options.textureDirectory =
      options.textureDirectory ??
      (presetDirectory ? inferTextureDirectory(presetDirectory) : undefined);

    const source = createCapture(options);
    const visualizer = createVisualizer(options);
    const instance = render(
      <App source={source} options={options} presets={presets} visualizer={visualizer} />,
    );
    await instance.waitUntilExit();
  } catch (error) {
    process.stderr.write(
      `Erreur: ${error instanceof Error ? error.message : String(error)}\n\n${HELP_TEXT}`,
    );
    process.exitCode = 1;
  }
}

await main();
