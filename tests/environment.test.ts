import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {loadLocalEnvironment} from '../src/environment.js';

test('local environment fills missing Telegram values from the example', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'teoleevo-env-'));
  const tokenBefore = process.env['TEOLEEVO_TELEGRAM_TOKEN'];
  const chatIdBefore = process.env['TEOLEEVO_TELEGRAM_CHAT_ID'];
  try {
    const primary = path.join(directory, '.env');
    const fallback = path.join(directory, '.env.example');
    await writeFile(
      primary,
      'TEOLEEVO_TELEGRAM_TOKEN=primary-token\nTEOLEEVO_TELEGRAM_CHAT_ID=\n',
    );
    await writeFile(
      fallback,
      'TEOLEEVO_TELEGRAM_TOKEN=fallback-token\n' +
        'TEOLEEVO_TELEGRAM_CHAT_ID=fallback-chat\n',
    );
    delete process.env['TEOLEEVO_TELEGRAM_TOKEN'];
    delete process.env['TEOLEEVO_TELEGRAM_CHAT_ID'];

    loadLocalEnvironment(primary, fallback);

    assert.equal(process.env['TEOLEEVO_TELEGRAM_TOKEN'], 'primary-token');
    assert.equal(process.env['TEOLEEVO_TELEGRAM_CHAT_ID'], 'fallback-chat');
  } finally {
    restoreEnvironment('TEOLEEVO_TELEGRAM_TOKEN', tokenBefore);
    restoreEnvironment('TEOLEEVO_TELEGRAM_CHAT_ID', chatIdBefore);
    await rm(directory, {recursive: true, force: true});
  }
});

test('local .env takes priority over the committed example', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'teoleevo-env-'));
  const tokenBefore = process.env['TEOLEEVO_TELEGRAM_TOKEN'];
  const chatIdBefore = process.env['TEOLEEVO_TELEGRAM_CHAT_ID'];
  try {
    const primary = path.join(directory, '.env');
    const fallback = path.join(directory, '.env.example');
    await writeFile(
      primary,
      'TEOLEEVO_TELEGRAM_TOKEN=primary-token\n' +
        'TEOLEEVO_TELEGRAM_CHAT_ID=primary-chat\n',
    );
    await writeFile(
      fallback,
      'TEOLEEVO_TELEGRAM_TOKEN=fallback-token\n' +
        'TEOLEEVO_TELEGRAM_CHAT_ID=fallback-chat\n',
    );
    delete process.env['TEOLEEVO_TELEGRAM_TOKEN'];
    delete process.env['TEOLEEVO_TELEGRAM_CHAT_ID'];

    loadLocalEnvironment(primary, fallback);

    assert.equal(process.env['TEOLEEVO_TELEGRAM_TOKEN'], 'primary-token');
    assert.equal(process.env['TEOLEEVO_TELEGRAM_CHAT_ID'], 'primary-chat');
  } finally {
    restoreEnvironment('TEOLEEVO_TELEGRAM_TOKEN', tokenBefore);
    restoreEnvironment('TEOLEEVO_TELEGRAM_CHAT_ID', chatIdBefore);
    await rm(directory, {recursive: true, force: true});
  }
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
