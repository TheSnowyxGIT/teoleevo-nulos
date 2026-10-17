#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {parseCli, HELP_TEXT} from './cli-options.js';
import {createCapture} from './audio/create-capture.js';
import {ControlCommandBus} from './control/command-bus.js';
import {LocalControlServer} from './control/server.js';
import {loadLocalEnvironment} from './environment.js';
import {
  findDefaultNestDropDirectory,
  findDefaultPresetDirectory,
  inferTextureDirectory,
  resolveNestDropInstallation,
  scanPresets,
} from './presets/catalog.js';
import {optionsFromSettings, SettingsStore} from './persistence/settings-store.js';
import {createTelegramRemoteFromEnvironment} from './telegram/remote.js';
import {App} from './ui/app.js';
import {createVisualizer} from './visualizer/create-visualizer.js';

async function main(): Promise<void> {
  try {
    loadLocalEnvironment();
    const settingsStore = new SettingsStore();
    const initialSettings = await settingsStore.load();
    const {options, help} = parseCli(
      process.argv.slice(2),
      optionsFromSettings(initialSettings),
    );
    if (help) {
      process.stdout.write(HELP_TEXT.trimStart());
      return;
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('Teoleevo doit être lancé dans un terminal interactif.');
    }

    const nestDropDirectory =
      options.nestDropDirectory ?? findDefaultNestDropDirectory();
    if (nestDropDirectory) {
      const installation = resolveNestDropInstallation(nestDropDirectory);
      options.nestDropDirectory = installation.directory;
      options.presetDirectory ??= installation.presetDirectory;
      options.textureDirectory ??= installation.textureDirectory;
      options.nestDropRendererPath ??= installation.rendererPath;
    }

    const presetDirectory = options.presetDirectory ?? findDefaultPresetDirectory();
    const presets = presetDirectory ? await scanPresets(presetDirectory) : [];
    options.presetDirectory = presetDirectory;
    options.textureDirectory =
      options.textureDirectory ??
      (presetDirectory ? inferTextureDirectory(presetDirectory) : undefined);

    const source = createCapture(options);
    const visualizer = createVisualizer(options);
    const commandBus = new ControlCommandBus();
    const controlServer = options.webEnabled
      ? new LocalControlServer(options.webPort, commandBus)
      : undefined;
    const telegramRemote = createTelegramRemoteFromEnvironment(commandBus);
    await controlServer?.start();
    telegramRemote?.start();
    try {
      const instance = render(
        <App
          source={source}
          options={options}
          presets={presets}
          visualizer={visualizer}
          commandBus={commandBus}
          controlServer={controlServer}
          telegramEnabled={Boolean(telegramRemote)}
          initialSettings={initialSettings}
          saveSettings={settings => settingsStore.save(settings)}
        />,
        {incrementalRendering: true},
      );
      await instance.waitUntilExit();
    } finally {
      await Promise.allSettled([
        controlServer?.stop() ?? Promise.resolve(),
        telegramRemote?.stop() ?? Promise.resolve(),
      ]);
    }
  } catch (error) {
    process.stderr.write(
      `Erreur: ${error instanceof Error ? error.message : String(error)}\n\n${HELP_TEXT}`,
    );
    process.exitCode = 1;
  }
}

await main();
