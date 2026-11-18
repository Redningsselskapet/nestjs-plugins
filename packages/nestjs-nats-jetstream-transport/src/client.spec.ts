import { connect } from 'nats';
import { lastValueFrom } from 'rxjs';
import { NatsJetStreamClientProxy } from './client';
import { NatsJetStreamClientOptions } from './interfaces/nats-jetstream-client-options.interface';

jest.mock('nats', () => ({
  ...jest.requireActual('nats'),
  connect: jest.fn(),
}));

function fakeConnection() {
  const js = { publish: jest.fn(async () => ({ stream: 's', seq: 1 })) };
  const nc = {
    jetstream: jest.fn((_options?: unknown) => js),
    drain: jest.fn(async () => undefined),
  };
  (connect as jest.Mock).mockResolvedValue(nc);
  return { nc, js };
}

const connectionOptions = { name: 'test' };

beforeEach(() => jest.clearAllMocks());

describe('NatsJetStreamClientProxy', () => {
  describe('JetStream options', () => {
    async function emitWith(options: Partial<NatsJetStreamClientOptions>) {
      const { nc } = fakeConnection();
      const client = new NatsJetStreamClientProxy({
        connectionOptions,
        ...options,
      });
      await lastValueFrom(client.emit('order.created', { id: 1 }));
      return nc.jetstream.mock.calls[0][0];
    }

    it('uses jetStreamOptions', async () => {
      expect(await emitWith({ jetStreamOptions: { timeout: 1 } })).toEqual({
        timeout: 1,
      });
    });

    it('still uses the deprecated jetStreamOption', async () => {
      expect(await emitWith({ jetStreamOption: { timeout: 2 } })).toEqual({
        timeout: 2,
      });
    });

    it('prefers jetStreamOptions when both are set', async () => {
      expect(
        await emitWith({
          jetStreamOption: { timeout: 2 },
          jetStreamOptions: { timeout: 1 },
        }),
      ).toEqual({ timeout: 1 });
    });

    it('passes undefined when neither is set', async () => {
      expect(await emitWith({})).toBeUndefined();
    });
  });

  it('reuses one connection', async () => {
    const { nc } = fakeConnection();
    const client = new NatsJetStreamClientProxy({ connectionOptions });

    expect(await client.connect()).toBe(nc);
    expect(await client.connect()).toBe(nc);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  describe('close', () => {
    it('does nothing when the client never connected', async () => {
      await expect(
        new NatsJetStreamClientProxy({ connectionOptions }).close(),
      ).resolves.toBeUndefined();
    });

    it('drains once and tolerates a second close', async () => {
      const { nc } = fakeConnection();
      const client = new NatsJetStreamClientProxy({ connectionOptions });
      await client.connect();

      await client.close();
      await client.close();

      expect(nc.drain).toHaveBeenCalledTimes(1);
    });
  });
});
