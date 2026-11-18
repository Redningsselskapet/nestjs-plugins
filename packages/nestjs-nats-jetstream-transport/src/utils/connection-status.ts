import { EventEmitter } from 'events';
import { NatsConnection } from 'nats';
import { distinctUntilChanged, Observable, ReplaySubject } from 'rxjs';

/**
 * Connection states reported by `status`. The values match NestJS 11's
 * `NatsStatus`, which only exists as a const enum in NestJS 11 itself.
 */
export const NatsJetStreamStatus = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
} as const;
export type NatsJetStreamStatus =
  (typeof NatsJetStreamStatus)[keyof typeof NatsJetStreamStatus];

/**
 * Connection events that can be subscribed to with `on()`. The names match
 * NestJS 11's `NatsEventsMap`.
 */
export const NatsJetStreamEvents = {
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  UPDATE: 'update',
} as const;
export type NatsJetStreamEvents =
  (typeof NatsJetStreamEvents)[keyof typeof NatsJetStreamEvents];

/**
 * Tracks a NATS connection's status the way NestJS 11's built-in NATS
 * transport does, without relying on NestJS 11 base-class members, so it
 * works on every supported NestJS version.
 */
export class ConnectionStatus {
  private readonly status$ = new ReplaySubject<NatsJetStreamStatus>(1);
  private readonly events = new EventEmitter();

  get status(): Observable<NatsJetStreamStatus> {
    return this.status$.asObservable().pipe(distinctUntilChanged());
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  on(event: string, callback: Function) {
    this.events.on(event, callback as (...args: unknown[]) => void);
  }

  /** Reports the connection as connected and follows its status updates. */
  track(nc: NatsConnection) {
    this.status$.next(NatsJetStreamStatus.CONNECTED);
    void this.follow(nc);
  }

  disconnected() {
    this.status$.next(NatsJetStreamStatus.DISCONNECTED);
  }

  private async follow(nc: NatsConnection) {
    try {
      for await (const s of nc.status()) {
        switch (s.type) {
          case 'disconnect':
            this.status$.next(NatsJetStreamStatus.DISCONNECTED);
            this.events.emit(NatsJetStreamEvents.DISCONNECT, s.data);
            break;
          case 'reconnecting':
            this.status$.next(NatsJetStreamStatus.RECONNECTING);
            break;
          case 'reconnect':
            this.status$.next(NatsJetStreamStatus.CONNECTED);
            this.events.emit(NatsJetStreamEvents.RECONNECT, s.data);
            break;
          case 'update':
            this.events.emit(NatsJetStreamEvents.UPDATE, s.data);
            break;
        }
      }
    } catch {
      // The status iterator ends with the connection; nothing to report.
    }
  }
}
