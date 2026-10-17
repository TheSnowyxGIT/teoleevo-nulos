import type {ControlCommandBus} from '../control/command-bus.js';
import type {ControlCommand} from '../control/types.js';

interface TelegramRemoteOptions {
  token: string;
  chatId?: string;
  pollTimeoutSeconds?: number;
  retryDelayMs?: number;
}

interface TelegramChat {
  id: number | string;
  type?: string;
}

interface TelegramMessage {
  chat: TelegramChat;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  data?: string;
  message?: {chat: TelegramChat};
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramApiResponse<Result> {
  ok: boolean;
  result?: Result;
  description?: string;
}

type Fetch = typeof globalThis.fetch;

const ALLOWED_UPDATES = ['message', 'callback_query'] as const;

export const TELEGRAM_REMOTE_KEYBOARD = {
  inline_keyboard: [
    [
      {text: '⏮ Précédent', callback_data: 'preset:previous'},
      {text: 'Suivant ⏭', callback_data: 'preset:next'},
    ],
    [
      {text: '⏸ Pause', callback_data: 'audio:pause'},
      {text: '▶ Reprendre', callback_data: 'audio:resume'},
    ],
    [
      {text: '🎨 Moteur ON', callback_data: 'renderer:start'},
      {text: 'Moteur OFF', callback_data: 'renderer:stop'},
    ],
    [
      {text: '⛶ Plein écran', callback_data: 'fullscreen:on'},
      {text: 'Fenêtre', callback_data: 'fullscreen:off'},
    ],
    [
      {text: '🔄 Auto ON', callback_data: 'auto:on'},
      {text: 'Auto OFF', callback_data: 'auto:off'},
    ],
    [
      {text: '🔀 Aléatoire', callback_data: 'shuffle:on'},
      {text: 'Séquentiel', callback_data: 'shuffle:off'},
    ],
    [
      {text: '🔔 Chime', callback_data: 'sound:chime'},
      {text: '💥 Impact', callback_data: 'sound:impact'},
      {text: '📣 Airhorn', callback_data: 'sound:airhorn'},
    ],
  ],
} as const;

const CALLBACK_COMMANDS: Readonly<Record<string, ControlCommand>> = {
  'preset:previous': {type: 'cycle-preset', direction: -1},
  'preset:next': {type: 'cycle-preset', direction: 1},
  'audio:pause': {type: 'set-paused', enabled: true},
  'audio:resume': {type: 'set-paused', enabled: false},
  'renderer:start': {type: 'set-renderer-running', enabled: true},
  'renderer:stop': {type: 'set-renderer-running', enabled: false},
  'fullscreen:on': {type: 'set-fullscreen', enabled: true},
  'fullscreen:off': {type: 'set-fullscreen', enabled: false},
  'auto:on': {type: 'set-auto-switch', enabled: true},
  'auto:off': {type: 'set-auto-switch', enabled: false},
  'shuffle:on': {type: 'set-shuffle', enabled: true},
  'shuffle:off': {type: 'set-shuffle', enabled: false},
  'sound:chime': {type: 'play-sound', sound: 'chime'},
  'sound:impact': {type: 'play-sound', sound: 'impact'},
  'sound:airhorn': {type: 'play-sound', sound: 'airhorn'},
};

export function commandForTelegramCallback(data: string): ControlCommand | undefined {
  return CALLBACK_COMMANDS[data];
}

export function commandForTelegramMessage(text: string): ControlCommand | undefined {
  if (/^\/next(?:@\w+)?\s*$/i.test(text)) {
    return {type: 'cycle-preset', direction: 1};
  }
  const sound = text.match(
    /^\/sound(?:@\w+)?(?:\s+(chime|impact|airhorn))?\s*$/i,
  )?.[1]?.toLowerCase() ?? (/^\/sound(?:@\w+)?\s*$/i.test(text) ? 'chime' : undefined);
  if (sound === 'chime' || sound === 'impact' || sound === 'airhorn') {
    return {type: 'play-sound', sound};
  }
  return undefined;
}

export function createTelegramRemoteFromEnvironment(
  commandBus: ControlCommandBus,
  fetchImplementation: Fetch = globalThis.fetch,
): TelegramRemote | undefined {
  const token = configuredEnvironmentValue('TEOLEEVO_TELEGRAM_TOKEN');
  if (!token) return undefined;
  const chatId = configuredEnvironmentValue('TEOLEEVO_TELEGRAM_CHAT_ID');
  return new TelegramRemote(
    {token, ...(chatId ? {chatId} : {})},
    commandBus,
    fetchImplementation,
  );
}

function configuredEnvironmentValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && !value.startsWith('replace-with-') ? value : undefined;
}

export class TelegramRemote {
  private readonly abortController = new AbortController();
  private running = false;
  private updateOffset: number | undefined;
  private loopPromise?: Promise<void>;

  constructor(
    private readonly options: TelegramRemoteOptions,
    private readonly commandBus: ControlCommandBus,
    private readonly fetchImplementation: Fetch = globalThis.fetch,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.run().catch(() => undefined);
  }

  async stop(): Promise<void> {
    this.running = false;
    this.abortController.abort();
    await this.loopPromise;
  }

  private async run(): Promise<void> {
    let initialized = false;
    while (this.running) {
      try {
        if (!initialized) {
          await this.discardPendingUpdates();
          initialized = true;
          if (this.options.chatId) {
            await this.sendControlPanel(this.options.chatId);
          }
        }
        const updates = await this.call<TelegramUpdate[]>('getUpdates', {
          ...(this.updateOffset === undefined ? {} : {offset: this.updateOffset}),
          timeout: this.options.pollTimeoutSeconds ?? 25,
          allowed_updates: ALLOWED_UPDATES,
        });
        for (const update of updates) {
          this.updateOffset = Math.max(this.updateOffset ?? 0, update.update_id + 1);
          await this.handleUpdate(update);
        }
      } catch (error) {
        if (!this.running || isAbortError(error)) return;
        await abortableDelay(
          this.options.retryDelayMs ?? 5_000,
          this.abortController.signal,
        );
      }
    }
  }

  private async discardPendingUpdates(): Promise<void> {
    const pending = await this.call<TelegramUpdate[]>('getUpdates', {
      offset: -1,
      timeout: 0,
      allowed_updates: ALLOWED_UPDATES,
    });
    const lastUpdate = pending.at(-1);
    if (lastUpdate) this.updateOffset = lastUpdate.update_id + 1;
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (message?.chat.type === 'private') {
      const receivedChatId = String(message.chat.id);
      if (isStartMessage(message.text)) {
        if (!this.options.chatId) {
          await this.sendSetupMessage(receivedChatId);
        } else if (receivedChatId === this.options.chatId) {
          await this.sendControlPanel(receivedChatId);
        }
        return;
      }
      const messageCommand = message.text
        ? commandForTelegramMessage(message.text)
        : undefined;
      if (receivedChatId === this.options.chatId && messageCommand) {
        this.commandBus.dispatch(messageCommand);
        await this.call('sendMessage', {
          chat_id: receivedChatId,
          text: feedbackForCommand(messageCommand),
        });
      }
      return;
    }

    const callback = update.callback_query;
    if (!callback) return;
    const callbackChatId = callback.message?.chat.id;
    const authorized =
      this.options.chatId !== undefined &&
      callbackChatId !== undefined &&
      String(callbackChatId) === this.options.chatId;
    const command = callback.data
      ? commandForTelegramCallback(callback.data)
      : undefined;
    if (authorized && command) this.commandBus.dispatch(command);
    await this.answerCallback(
      callback.id,
      authorized && command ? 'Commande envoyée' : 'Commande refusée',
      !authorized,
    );
  }

  private async sendSetupMessage(chatId: string): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text:
        `Votre chat ID est ${chatId}.\n\n` +
        'Ajoutez-le dans TEOLEEVO_TELEGRAM_CHAT_ID puis redémarrez Teoleevo. ' +
        'Les commandes disponibles sont /next et /sound.',
    });
  }

  private async sendControlPanel(chatId: string): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text:
        'Teoleevo est en ligne. Utilisez /next, /sound [chime|impact|airhorn] ' +
        'ou les boutons ci-dessous.',
      reply_markup: TELEGRAM_REMOTE_KEYBOARD,
    });
  }

  private async answerCallback(
    callbackQueryId: string,
    text: string,
    showAlert: boolean,
  ): Promise<void> {
    await this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  private async call<Result>(method: string, body: unknown): Promise<Result> {
    const response = await this.fetchImplementation(
      `https://api.telegram.org/bot${this.options.token}/${method}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      },
    );
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
    const value = await response.json() as TelegramApiResponse<Result>;
    if (!value.ok || value.result === undefined) {
      throw new Error(value.description ?? 'Réponse Telegram invalide');
    }
    return value.result;
  }
}

function isStartMessage(text: string | undefined): boolean {
  return typeof text === 'string' && /^\/start(?:@\w+)?(?:\s|$)/i.test(text);
}

function feedbackForCommand(command: ControlCommand): string {
  if (command.type === 'cycle-preset') return '⏭ Preset suivant';
  if (command.type === 'play-sound') {
    const labels = {chime: '🔔 Chime', impact: '💥 Impact', airhorn: '📣 Airhorn'};
    return `${labels[command.sound]} envoyé`;
  }
  return 'Commande envoyée';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>(resolve => {
    const timeout = setTimeout(done, milliseconds);
    signal.addEventListener('abort', done, {once: true});
    function done(): void {
      clearTimeout(timeout);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });
}
