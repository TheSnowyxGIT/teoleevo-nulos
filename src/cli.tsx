#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {parseCli, HELP_TEXT} from './cli-options.js';
import {createCapture} from './audio/create-capture.js';
import {App} from './ui/app.js';

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

    const source = createCapture(options);
    const instance = render(<App source={source} options={options} />);
    await instance.waitUntilExit();
  } catch (error) {
    process.stderr.write(
      `Erreur: ${error instanceof Error ? error.message : String(error)}\n\n${HELP_TEXT}`,
    );
    process.exitCode = 1;
  }
}

await main();
