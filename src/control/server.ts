import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import type {AddressInfo} from 'node:net';
import {CONTROL_PAGE} from './page.js';
import type {ControlCatalog, ControlCommand, ControlState} from './types.js';

type CommandListener = (command: ControlCommand) => void;

const EMPTY_CATALOG: ControlCatalog = {
  devices: [],
  displays: [],
  presets: [],
  playlists: [],
};

export class LocalControlServer {
  private readonly listeners = new Set<CommandListener>();
  private readonly clients = new Set<ServerResponse>();
  private catalog: ControlCatalog = EMPTY_CATALOG;
  private state?: ControlState;
  private catalogJson = JSON.stringify(EMPTY_CATALOG);
  private stateJson = 'null';
  private readonly server = createServer((request, response) => {
    void this.handleRequest(request, response);
  });
  private actualPort?: number;

  constructor(private readonly requestedPort = 4317) {}

  get url(): string {
    return `http://127.0.0.1:${this.actualPort ?? this.requestedPort}`;
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => reject(error);
      this.server.once('error', onError);
      this.server.listen(this.requestedPort, '127.0.0.1', () => {
        this.server.off('error', onError);
        const address = this.server.address() as AddressInfo;
        this.actualPort = address.port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients) client.end();
    this.clients.clear();
    if (!this.server.listening) return;
    await new Promise<void>((resolve, reject) => {
      this.server.close(error => error ? reject(error) : resolve());
    });
  }

  subscribe(listener: CommandListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateCatalog(catalog: ControlCatalog): void {
    const json = JSON.stringify(catalog);
    if (json === this.catalogJson) return;
    this.catalog = catalog;
    this.catalogJson = json;
    this.broadcast('catalog', json);
  }

  updateState(state: ControlState): void {
    const json = JSON.stringify(state);
    if (json === this.stateJson) return;
    this.state = state;
    this.stateJson = json;
    this.broadcast('state', json);
  }

  updateAudioFrame(
    levels: ControlState['audio']['levels'],
    db: ControlState['audio']['db'],
    hasSignal: boolean,
  ): void {
    if (!this.state) return;
    this.updateState({
      ...this.state,
      audio: {...this.state.audio, levels, db, hasSignal},
    });
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    const url = new URL(request.url ?? '/', this.url);

    if (method === 'GET' && url.pathname === '/') {
      this.send(response, 200, CONTROL_PAGE, 'text/html; charset=utf-8');
      return;
    }
    if (method === 'GET' && url.pathname === '/api/snapshot') {
      this.sendJson(response, 200, {catalog: this.catalog, state: this.state ?? null});
      return;
    }
    if (method === 'GET' && url.pathname === '/api/events') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      });
      response.write(`event: catalog\ndata: ${this.catalogJson}\n\n`);
      response.write(`event: state\ndata: ${this.stateJson}\n\n`);
      this.clients.add(response);
      request.once('close', () => this.clients.delete(response));
      return;
    }
    if (method === 'POST' && url.pathname === '/api/command') {
      if (!this.isAllowedOrigin(request) || request.headers['x-teoleevo-control'] !== '1') {
        this.sendJson(response, 403, {error: 'Requête refusée'});
        return;
      }
      try {
        const command = await this.readCommand(request);
        for (const listener of this.listeners) listener(command);
        this.sendJson(response, 202, {ok: true});
      } catch (error) {
        this.sendJson(response, 400, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }
    this.sendJson(response, 404, {error: 'Introuvable'});
  }

  private isAllowedOrigin(request: IncomingMessage): boolean {
    const origin = request.headers.origin;
    if (!origin) return true;
    try {
      const value = new URL(origin);
      const allowedHost =
        value.hostname === '127.0.0.1' ||
        value.hostname === 'localhost' ||
        value.hostname === '[::1]';
      return (
        value.protocol === 'http:' &&
        allowedHost &&
        Number(value.port || 80) === (this.actualPort ?? this.requestedPort)
      );
    } catch {
      return false;
    }
  }

  private async readCommand(request: IncomingMessage): Promise<ControlCommand> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 64 * 1024) throw new Error('Commande trop volumineuse');
      chunks.push(buffer);
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!isRecord(value) || typeof value['type'] !== 'string') {
      throw new Error('Commande invalide');
    }
    return value as ControlCommand;
  }

  private broadcast(event: string, data: string): void {
    const message = `event: ${event}\ndata: ${data}\n\n`;
    for (const client of this.clients) client.write(message);
  }

  private sendJson(response: ServerResponse, status: number, value: unknown): void {
    this.send(response, status, JSON.stringify(value), 'application/json; charset=utf-8');
  }

  private send(
    response: ServerResponse,
    status: number,
    body: string,
    contentType: string,
  ): void {
    response.writeHead(status, {
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
      'Referrer-Policy': 'no-referrer',
    });
    response.end(body);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
