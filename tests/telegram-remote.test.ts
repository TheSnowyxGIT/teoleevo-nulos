import assert from 'node:assert/strict';
import test from 'node:test';
import {ControlCommandBus} from '../src/control/command-bus.js';
import type {ControlCommand} from '../src/control/types.js';
import {
  commandForTelegramCallback,
  commandForTelegramMessage,
  TelegramRemote,
} from '../src/telegram/remote.js';

test('Telegram callback buttons map only to fixed control commands', () => {
  assert.deepEqual(commandForTelegramCallback('preset:next'), {
    type: 'cycle-preset',
    direction: 1,
  });
  assert.deepEqual(commandForTelegramCallback('audio:pause'), {
    type: 'set-paused',
    enabled: true,
  });
  assert.deepEqual(commandForTelegramCallback('sound:impact'), {
    type: 'play-sound',
    sound: 'impact',
  });
  assert.equal(commandForTelegramCallback('/next'), undefined);
  assert.equal(commandForTelegramCallback('unknown'), undefined);
});

test('Telegram sound commands accept only the supported effects', () => {
  assert.deepEqual(commandForTelegramMessage('/sound'), {
    type: 'play-sound',
    sound: 'chime',
  });
  assert.deepEqual(commandForTelegramMessage('/sound impact'), {
    type: 'play-sound',
    sound: 'impact',
  });
  assert.deepEqual(commandForTelegramMessage('/sound@teoleevobot AIRHORN'), {
    type: 'play-sound',
    sound: 'airhorn',
  });
  assert.equal(commandForTelegramMessage('/sound unknown'), undefined);
  assert.equal(commandForTelegramMessage('sound chime'), undefined);
});

test('Telegram accepts only the exact /next message command', () => {
  assert.deepEqual(commandForTelegramMessage('/next'), {
    type: 'cycle-preset',
    direction: 1,
  });
  assert.deepEqual(commandForTelegramMessage('/next@teoleevobot'), {
    type: 'cycle-preset',
    direction: 1,
  });
  assert.equal(commandForTelegramMessage('next'), undefined);
  assert.equal(commandForTelegramMessage('/next please'), undefined);
  assert.equal(commandForTelegramMessage('/previous'), undefined);
});

test('Telegram remote discards stale updates and accepts authorized /next', async () => {
  const methods: string[] = [];
  let getUpdatesCalls = 0;
  const fetchImplementation = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const method = String(input).split('/').at(-1) ?? '';
    methods.push(method);
    if (method !== 'getUpdates') return telegramResponse(true);
    getUpdatesCalls += 1;
    if (getUpdatesCalls === 1) {
      return telegramResponse([
        {
          update_id: 10,
          callback_query: {
            id: 'stale',
            data: 'preset:previous',
            message: {chat: {id: 42, type: 'private'}},
          },
        },
      ]);
    }
    if (getUpdatesCalls === 2) {
      return telegramResponse([
        {
          update_id: 11,
          message: {chat: {id: 42, type: 'private'}, text: 'preset:previous'},
        },
        {
          update_id: 12,
          message: {chat: {id: 42, type: 'private'}, text: '/next'},
        },
        {
          update_id: 13,
          message: {chat: {id: 42, type: 'private'}, text: '/sound impact'},
        },
        {
          update_id: 14,
          callback_query: {
            id: 'unauthorized',
            data: 'preset:previous',
            message: {chat: {id: 99, type: 'private'}},
          },
        },
        {
          update_id: 15,
          callback_query: {
            id: 'fresh',
            data: 'preset:next',
            message: {chat: {id: 42, type: 'private'}},
          },
        },
      ]);
    }
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        {once: true},
      );
    });
  };

  const commandBus = new ControlCommandBus();
  const commands: ControlCommand[] = [];
  let resolveCommands: (() => void) | undefined;
  const received = new Promise<void>(resolve => {
    resolveCommands = resolve;
  });
  commandBus.subscribe(command => {
    commands.push(command);
    if (commands.length === 3) resolveCommands?.();
  });
  const remote = new TelegramRemote(
    {token: 'test-token', chatId: '42', pollTimeoutSeconds: 1},
    commandBus,
    fetchImplementation as typeof fetch,
  );

  remote.start();
  await received;
  await remote.stop();

  assert.deepEqual(commands, [
    {type: 'cycle-preset', direction: 1},
    {type: 'play-sound', sound: 'impact'},
    {type: 'cycle-preset', direction: 1},
  ]);
  assert.ok(methods.includes('sendMessage'));
  assert.equal(methods.filter(method => method === 'answerCallbackQuery').length, 2);
});

function telegramResponse(result: unknown): Response {
  return new Response(JSON.stringify({ok: true, result}), {
    status: 200,
    headers: {'Content-Type': 'application/json'},
  });
}
