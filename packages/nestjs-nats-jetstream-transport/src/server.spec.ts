import { Logger } from '@nestjs/common';
import { connect, JSONCodec, StringCodec } from 'nats';
import { of, throwError } from 'rxjs';
import { NatsJetStreamServerOptions } from './interfaces/nats-jetstream-server-options.interface';
import { NatsJetStreamServer } from './server';

jest.mock('nats', () => ({
  ...jest.requireActual('nats'),
  connect: jest.fn(),
}));

const json = JSONCodec();
const text = StringCodec();

interface FakeJsMsg {
  subject: string;
  data: Uint8Array;
  ack: jest.Mock;
  nak: jest.Mock;
  term: jest.Mock;
}

function jsMsg(data: Uint8Array, subject = 'order.created'): FakeJsMsg {
  return { subject, data, ack: jest.fn(), nak: jest.fn(), term: jest.fn() };
}

function fakeSubscription(messages: FakeJsMsg[]) {
  return {
    destroy: jest.fn(),
    async *[Symbol.asyncIterator]() {
      for (const m of messages) {
        yield m;
      }
    },
  };
}

function fakeConnection(options: {
  messages?: FakeJsMsg[];
  streams?: { config: { name: string; subjects: string[] } }[];
  statusUpdates?: { type: string; data?: unknown }[];
}) {
  const subscription = fakeSubscription(options.messages ?? []);
  const streams = options.streams ?? [];
  const jsm = {
    streams: {
      // Mirrors nats' Lister: async-iterable across pages.
      list: jest.fn(() => ({
        async next() {
          return streams.slice(0, 2);
        },
        async *[Symbol.asyncIterator]() {
          for (const s of streams) {
            yield s;
          }
        },
      })),
      add: jest.fn(async (config) => ({ config })),
      update: jest.fn(async (_name, config) => ({ config })),
    },
  };
  const nc = {
    jetstreamManager: jest.fn(async () => jsm),
    jetstream: jest.fn(() => ({
      subscribe: jest.fn(async () => subscription),
    })),
    subscribe: jest.fn(),
    drain: jest.fn(async () => undefined),
    isDraining: jest.fn(() => false),
    isClosed: jest.fn(() => false),
    status: jest.fn(() =>
      (async function* () {
        for (const u of options.statusUpdates ?? []) {
          yield u;
        }
      })(),
    ),
  };
  (connect as jest.Mock).mockResolvedValue(nc);
  return { nc, jsm, subscription };
}

const baseOptions: NatsJetStreamServerOptions = {
  connectionOptions: { name: 'test' },
  consumerOptions: { durable: 'svc', manualAck: true },
};

/** Resolves once the server has consumed every fake message. */
async function drained(subscription: { destroy: jest.Mock }) {
  for (let i = 0; i < 100 && !subscription.destroy.mock.calls.length; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  // Let error callbacks scheduled by the last message run.
  await new Promise((resolve) => setImmediate(resolve));
}

async function listen(server: NatsJetStreamServer) {
  await new Promise<void>((resolve) => server.listen(() => resolve()));
}

function settled(msg: FakeJsMsg) {
  return {
    ack: msg.ack.mock.calls,
    nak: msg.nak.mock.calls,
    term: msg.term.mock.calls,
  };
}

beforeAll(() => Logger.overrideLogger(false));
beforeEach(() => jest.clearAllMocks());

describe('NatsJetStreamServer', () => {
  describe('eventHandlerError validation', () => {
    it.each([
      [{ action: 'nak', nakDelay: -1 }, /nakDelay must be/],
      [{ action: 'nak', nakDelay: Number.NaN }, /nakDelay must be/],
      [{ action: 'term', nakDelay: 100 }, /only valid with action 'nak'/],
      [{ action: 'retry' }, /action must be 'term' or 'nak'/],
    ])('rejects %j', (eventHandlerError, message) => {
      expect(
        () =>
          new NatsJetStreamServer({
            ...baseOptions,
            eventHandlerError: eventHandlerError as any,
          }),
      ).toThrow(message);
    });

    it.each([
      [undefined],
      [{ action: 'term' }],
      [{ action: 'nak' }],
      [{ action: 'nak', nakDelay: 0 }],
      [{ action: 'nak', nakDelay: 5000 }],
    ])('accepts %j', (eventHandlerError) => {
      expect(
        () =>
          new NatsJetStreamServer({
            ...baseOptions,
            eventHandlerError: eventHandlerError as any,
          }),
      ).not.toThrow();
    });
  });

  describe('event handler errors', () => {
    // Nest wraps every handler so that an exception comes back as an Observable
    // that errors; the fake handlers below return exactly that.
    const failingHandler = jest.fn(async () =>
      throwError(() => new Error('handler failed')),
    );

    async function run(options: Partial<NatsJetStreamServerOptions>) {
      const msg = jsMsg(json.encode({ id: 1 }));
      const { subscription } = fakeConnection({ messages: [msg] });
      const server = new NatsJetStreamServer({ ...baseOptions, ...options });
      server.addHandler('order.created', failingHandler, true);
      await listen(server);
      await drained(subscription);
      return msg;
    }

    it('leaves the message unsettled by default, as earlier versions did', async () => {
      const msg = await run({});
      expect(failingHandler).toHaveBeenCalledWith({ id: 1 }, expect.anything());
      expect(settled(msg)).toEqual({ ack: [], nak: [], term: [] });
    });

    it('terminates the message with action term', async () => {
      const msg = await run({ eventHandlerError: { action: 'term' } });
      expect(settled(msg)).toEqual({ ack: [], nak: [], term: [[]] });
    });

    it('naks with the configured delay with action nak', async () => {
      const msg = await run({
        eventHandlerError: { action: 'nak', nakDelay: 5000 },
      });
      expect(settled(msg)).toEqual({ ack: [], nak: [[5000]], term: [] });
    });

    it('naks without a delay when none is configured', async () => {
      const msg = await run({ eventHandlerError: { action: 'nak' } });
      expect(settled(msg)).toEqual({ ack: [], nak: [[undefined]], term: [] });
    });

    it('does not settle a message whose handler succeeds', async () => {
      const msg = jsMsg(json.encode({ id: 1 }));
      const { subscription } = fakeConnection({ messages: [msg] });
      const server = new NatsJetStreamServer({
        ...baseOptions,
        eventHandlerError: { action: 'term' },
      });
      server.addHandler('order.created', async () => of(undefined), true);
      await listen(server);
      await drained(subscription);
      expect(settled(msg)).toEqual({ ack: [], nak: [], term: [] });
    });

    it('still terminates a handler that throws outside Nest by default', async () => {
      const msg = jsMsg(json.encode({ id: 1 }));
      const { subscription } = fakeConnection({ messages: [msg] });
      const server = new NatsJetStreamServer(baseOptions);
      server.addHandler(
        'order.created',
        async () => {
          throw new Error('raw');
        },
        true,
      );
      await listen(server);
      await drained(subscription);
      expect(settled(msg)).toEqual({ ack: [], nak: [], term: [[]] });
    });

    it('terminates an undecodable payload whatever the setting', async () => {
      const msg = jsMsg(text.encode('not json'));
      const { subscription } = fakeConnection({ messages: [msg] });
      const server = new NatsJetStreamServer({
        ...baseOptions,
        eventHandlerError: { action: 'nak' },
      });
      const handler = jest.fn();
      server.addHandler('order.created', handler, true);
      await listen(server);
      await drained(subscription);
      expect(handler).not.toHaveBeenCalled();
      expect(settled(msg)).toEqual({ ack: [], nak: [], term: [[]] });
    });
  });

  describe('request/reply', () => {
    async function subscribeCallback(handler = jest.fn(async () => 42)) {
      const { nc } = fakeConnection({});
      const server = new NatsJetStreamServer({
        ...baseOptions,
        consumerOptions: { deliverTo: 'svc-messages' },
      });
      server.addHandler({ cmd: 'sum' }, handler as any, false);
      await listen(server);
      const [, subscriptionOptions] = nc.subscribe.mock.calls[0];
      return { callback: subscriptionOptions.callback, handler };
    }

    function requestMsg(data: Uint8Array) {
      return {
        subject: '{"cmd":"sum"}',
        reply: '_INBOX.x',
        data,
        respond: jest.fn(),
      };
    }

    it('answers an undecodable request with an error packet', async () => {
      const { callback, handler } = await subscribeCallback();
      const msg = requestMsg(text.encode('not json'));

      await callback(null, msg);

      expect(handler).not.toHaveBeenCalled();
      expect(msg.respond).toHaveBeenCalledTimes(1);
      expect(json.decode(msg.respond.mock.calls[0][0])).toEqual({
        err: { status: 'error', message: 'Invalid JSON payload' },
        isDisposed: true,
      });
    });

    it('answers an empty request with an error packet', async () => {
      const { callback } = await subscribeCallback();
      const msg = requestMsg(new Uint8Array(0));
      await expect(callback(null, msg)).resolves.toBeUndefined();
      expect(json.decode(msg.respond.mock.calls[0][0])).toMatchObject({
        isDisposed: true,
      });
    });

    it('still passes a JSON null payload to the handler', async () => {
      const { callback, handler } = await subscribeCallback();
      await callback(null, requestMsg(json.encode(null)));
      expect(handler).toHaveBeenCalledWith(null, expect.anything());
    });
  });

  describe('stream setup', () => {
    it('updates a stream that is not on the first page of the listing', async () => {
      const streams = Array.from({ length: 300 }, (_, i) => ({
        config: { name: `stream-${i}`, subjects: [`s${i}.*`] },
      }));
      const { jsm } = fakeConnection({ streams });
      const server = new NatsJetStreamServer({
        ...baseOptions,
        streamConfig: { name: 'stream-280', subjects: ['extra.*'] },
      });

      await listen(server);

      expect(jsm.streams.add).not.toHaveBeenCalled();
      expect(jsm.streams.update).toHaveBeenCalledWith('stream-280', {
        name: 'stream-280',
        subjects: ['s280.*', 'extra.*'],
      });
    });

    it('creates a stream that does not exist', async () => {
      const { jsm } = fakeConnection({ streams: [] });
      const config = { name: 'orders', subjects: ['order.*'] };
      const server = new NatsJetStreamServer({
        ...baseOptions,
        streamConfig: config,
      });

      await listen(server);

      expect(jsm.streams.add).toHaveBeenCalledWith(config);
      expect(jsm.streams.update).not.toHaveBeenCalled();
    });
  });

  describe('NestJS 11 transport members', () => {
    it('unwrap() throws before listen and returns the connection after', async () => {
      const { nc } = fakeConnection({});
      const server = new NatsJetStreamServer(baseOptions);

      expect(() => server.unwrap()).toThrow(/Not initialized/);
      await listen(server);
      expect(server.unwrap()).toBe(nc);
    });

    it('reports status and forwards connection events', async () => {
      fakeConnection({
        statusUpdates: [
          { type: 'disconnect', data: 'nats://a' },
          { type: 'reconnecting' },
          { type: 'reconnect', data: 'nats://a' },
        ],
      });
      const server = new NatsJetStreamServer(baseOptions);
      const seen: string[] = [];
      const events: [string, unknown][] = [];
      server.status.subscribe((s) => seen.push(s));
      server.on('disconnect', (d: unknown) => events.push(['disconnect', d]));
      server.on('reconnect', (d: unknown) => events.push(['reconnect', d]));

      await listen(server);
      await new Promise((resolve) => setImmediate(resolve));

      expect(seen).toEqual([
        'connected',
        'disconnected',
        'reconnecting',
        'connected',
      ]);
      expect(events).toEqual([
        ['disconnect', 'nats://a'],
        ['reconnect', 'nats://a'],
      ]);
    });

    it('reports disconnected after close', async () => {
      fakeConnection({});
      const server = new NatsJetStreamServer(baseOptions);
      const seen: string[] = [];
      server.status.subscribe((s) => seen.push(s));

      await listen(server);
      await server.close();

      expect(seen).toEqual(['connected', 'disconnected']);
      expect(() => server.unwrap()).toThrow(/Not initialized/);
    });
  });

  describe('close', () => {
    it('does nothing when the server never connected', async () => {
      await expect(
        new NatsJetStreamServer(baseOptions).close(),
      ).resolves.toBeUndefined();
    });

    it('drains once and tolerates a second close', async () => {
      const { nc } = fakeConnection({});
      const server = new NatsJetStreamServer(baseOptions);
      await listen(server);

      await server.close();
      await server.close();

      expect(nc.drain).toHaveBeenCalledTimes(1);
    });

    it('does not throw when a subscription finishes after close', async () => {
      const msg = jsMsg(json.encode({ id: 1 }));
      const { nc, subscription } = fakeConnection({ messages: [msg] });
      nc.isDraining.mockReturnValue(true);
      const server = new NatsJetStreamServer(baseOptions);
      server.addHandler('order.created', async () => of(undefined), true);
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      await listen(server);
      await server.close();
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      process.off('unhandledRejection', unhandled);
      expect(unhandled).not.toHaveBeenCalled();
      expect(subscription.destroy).not.toHaveBeenCalled();
    });
  });
});
