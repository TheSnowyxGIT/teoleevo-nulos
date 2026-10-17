import type {ControlCommand} from './types.js';

export type ControlCommandListener = (command: ControlCommand) => void;

export class ControlCommandBus {
  private readonly listeners = new Set<ControlCommandListener>();

  subscribe(listener: ControlCommandListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(command: ControlCommand): void {
    for (const listener of this.listeners) listener(command);
  }
}
