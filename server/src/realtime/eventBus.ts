import { EventEmitter } from 'node:events';
import type { HackathonEvent, HackathonEventType } from '@hackametz/shared';
import { nowIso } from '../utils/time';

type Listener = (event: HackathonEvent) => void;

/** Bus d'événements en mémoire : les services publient, les connexions SSE écoutent par hackathon. */
export class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit(type: HackathonEventType, hackathonSlug: string, message: string): void {
    const event: HackathonEvent = { type, hackathonSlug, at: nowIso(), message };
    this.emitter.emit(`hackathon:${hackathonSlug}`, event);
    this.emitter.emit('*', event);
  }

  subscribe(hackathonSlug: string, listener: Listener): () => void {
    const channel = `hackathon:${hackathonSlug}`;
    this.emitter.on(channel, listener);
    return () => this.emitter.off(channel, listener);
  }

  subscribeAll(listener: Listener): () => void {
    this.emitter.on('*', listener);
    return () => this.emitter.off('*', listener);
  }
}
