import { NatsConnection } from 'nats';
import {
  ConnectionStatus,
  NatsJetStreamEvents,
  NatsJetStreamStatus,
} from './connection-status';

/** A fake connection whose status() yields the given updates. */
function fakeConnection(updates: { type: string; data?: unknown }[]) {
  return {
    status: () =>
      (async function* () {
        for (const u of updates) {
          yield u;
        }
      })(),
  } as unknown as NatsConnection;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ConnectionStatus', () => {
  it('uses the same values as NestJS 11 NatsStatus and NatsEventsMap', () => {
    expect(NatsJetStreamStatus).toEqual({
      CONNECTED: 'connected',
      DISCONNECTED: 'disconnected',
      RECONNECTING: 'reconnecting',
    });
    expect(NatsJetStreamEvents).toEqual({
      DISCONNECT: 'disconnect',
      RECONNECT: 'reconnect',
      UPDATE: 'update',
    });
  });

  it('reports connected, then follows disconnect, reconnecting and reconnect', async () => {
    const status = new ConnectionStatus();
    const seen: string[] = [];
    status.status.subscribe((s) => seen.push(s));

    status.track(
      fakeConnection([
        { type: 'disconnect', data: 'nats://a:4222' },
        { type: 'reconnecting', data: 'nats://a:4222' },
        { type: 'reconnect', data: 'nats://a:4222' },
      ]),
    );
    await flush();

    expect(seen).toEqual([
      'connected',
      'disconnected',
      'reconnecting',
      'connected',
    ]);
  });

  it('does not repeat an unchanged status', async () => {
    const status = new ConnectionStatus();
    const seen: string[] = [];
    status.status.subscribe((s) => seen.push(s));

    status.track(fakeConnection([{ type: 'pingTimer' }, { type: 'update' }]));
    await flush();

    expect(seen).toEqual(['connected']);
  });

  it('replays the latest status to a late subscriber', async () => {
    const status = new ConnectionStatus();
    status.track(fakeConnection([{ type: 'disconnect' }]));
    await flush();

    const seen: string[] = [];
    status.status.subscribe((s) => seen.push(s));
    expect(seen).toEqual(['disconnected']);
  });

  it('emits disconnect, reconnect and update with their data', async () => {
    const status = new ConnectionStatus();
    const events: [string, unknown][] = [];
    for (const name of ['disconnect', 'reconnect', 'update', 'error']) {
      status.on(name, (data: unknown) => events.push([name, data]));
    }

    status.track(
      fakeConnection([
        { type: 'disconnect', data: 'a' },
        { type: 'reconnect', data: 'b' },
        { type: 'update', data: { added: ['c'] } },
        { type: 'error', data: 'not forwarded' },
      ]),
    );
    await flush();

    expect(events).toEqual([
      ['disconnect', 'a'],
      ['reconnect', 'b'],
      ['update', { added: ['c'] }],
    ]);
  });

  it('does not throw when nothing listens', async () => {
    const status = new ConnectionStatus();
    status.track(fakeConnection([{ type: 'disconnect' }, { type: 'error' }]));
    await expect(flush()).resolves.toBeUndefined();
  });

  it('stops quietly when the status iterator fails', async () => {
    const status = new ConnectionStatus();
    const nc = {
      status: () =>
        (async function* () {
          throw new Error('connection closed');
        })(),
    } as unknown as NatsConnection;

    status.track(nc);
    await flush();

    const seen: string[] = [];
    status.status.subscribe((s) => seen.push(s));
    expect(seen).toEqual(['connected']);
  });

  it('reports disconnected when told the connection was closed', () => {
    const status = new ConnectionStatus();
    const seen: string[] = [];
    status.status.subscribe((s) => seen.push(s));

    status.disconnected();

    expect(seen).toEqual(['disconnected']);
  });
});
