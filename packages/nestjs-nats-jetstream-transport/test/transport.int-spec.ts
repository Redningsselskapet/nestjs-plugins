import 'reflect-metadata';
import { execFileSync } from 'child_process';
import { Controller, INestMicroservice, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import {
  connect,
  JetStreamManager,
  NatsConnection,
  RetentionPolicy,
  StorageType,
  StringCodec,
} from 'nats';
import { lastValueFrom } from 'rxjs';
import {
  NatsJetStreamClientProxy,
  NatsJetStreamContext,
  NatsJetStreamServer,
  NatsJetStreamServerOptions,
  NatsRequestOptionsBuilder,
} from '../src';

// Integration tests need a JetStream-enabled server:
//   docker run -d -p 4222:4222 nats:2.10 -js
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const RUN = `it${Date.now().toString(36)}`;
const STREAM = `${RUN}-stream`;
const SUBJECTS = ['itest.*'];

interface Delivery {
  at: number;
  redeliveryCount: number;
  data: unknown;
}
const deliveries: Record<'ok' | 'fail', Delivery[]> = { ok: [], fail: [] };

function record(kind: 'ok' | 'fail', data: unknown, ctx: NatsJetStreamContext) {
  deliveries[kind].push({
    at: Date.now(),
    redeliveryCount: ctx.message.info.redeliveryCount,
    data,
  });
}

@Controller()
class TestController {
  @EventPattern('itest.ok')
  ok(@Payload() data: unknown, @Ctx() ctx: NatsJetStreamContext) {
    record('ok', data, ctx);
    ctx.message.ack();
  }

  // Like a handler hitting a database outage: it throws without settling.
  @EventPattern('itest.fail')
  fail(@Payload() data: unknown, @Ctx() ctx: NatsJetStreamContext) {
    record('fail', data, ctx);
    throw new Error('handler failed');
  }

  @MessagePattern({ cmd: 'itest-sum' })
  sum(@Payload() data: number[]) {
    return data.reduce((a, b) => a + b, 0);
  }
}

@Module({ controllers: [TestController] })
class TestModule {}

let admin: NatsConnection;
let server: NatsJetStreamServer | undefined;
let jsm: JetStreamManager;
let app: INestMicroservice | undefined;
let client: NatsJetStreamClientProxy | undefined;
let durableCounter = 0;

async function boot(
  options: Partial<NatsJetStreamServerOptions> = {},
  storage: StorageType = StorageType.Memory,
) {
  const { consumerOptions, ...rest } = options;
  app = await NestFactory.createMicroservice(TestModule, {
    logger: false,
    strategy: (server = new NatsJetStreamServer({
      connectionOptions: { servers: NATS_URL, name: `${RUN}-server` },
      consumerOptions: {
        durable: `${RUN}-durable-${++durableCounter}`,
        deliverGroup: `${RUN}-group`,
        deliverTo: `${RUN}-messages`,
        manualAck: true,
        ackWait: 1000,
        ...consumerOptions,
      },
      streamConfig: {
        name: STREAM,
        subjects: SUBJECTS,
        storage,
        retention: RetentionPolicy.Limits,
      },
      ...rest,
    })),
  });
  await app.listen();
  client = new NatsJetStreamClientProxy({
    connectionOptions: { servers: NATS_URL, name: `${RUN}-client` },
  });
}

async function waitFor(check: () => boolean, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  while (!check() && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return check();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Deletes this run's streams, plus any stream an earlier, aborted run left on
// the test subjects (it would make stream setup fail with overlapping subjects).
async function deleteStreams(prefix: string) {
  for await (const info of jsm.streams.list()) {
    const leftover = info.config.subjects?.some((s) => s.startsWith('itest.'));
    if (info.config.name.startsWith(prefix) || leftover) {
      await jsm.streams.delete(info.config.name);
    }
  }
}

beforeAll(async () => {
  admin = await connect({ servers: NATS_URL, name: `${RUN}-admin` });
  jsm = await admin.jetstreamManager();
  await deleteStreams(RUN);
});

afterEach(async () => {
  try {
    await client?.close();
    await app?.close();
  } finally {
    client = undefined;
    app = undefined;
    server = undefined;
    deliveries.ok = [];
    deliveries.fail = [];
    await deleteStreams(RUN);
  }
});

afterAll(async () => {
  await admin?.drain();
});

describe('NatsJetStream transport against a real server', () => {
  it('delivers an emitted event to its handler', async () => {
    await boot();
    const ack = await lastValueFrom(client.emit('itest.ok', { id: 1 }));

    expect(ack).toMatchObject({ stream: STREAM });
    expect(await waitFor(() => deliveries.ok.length === 1, 5000)).toBe(true);
    expect(deliveries.ok[0]).toMatchObject({
      data: { id: 1 },
      redeliveryCount: 1,
    });
  });

  it('answers a request', async () => {
    await boot();
    const builder = new NatsRequestOptionsBuilder([1, 2, 3]);
    builder.setTimeout(5000);

    const result = await lastValueFrom(
      client.send({ cmd: 'itest-sum' }, builder.build()),
    );

    expect(result).toBe(6);
  });

  it('fails a request with an invalid payload before its timeout', async () => {
    await boot();
    const sc = StringCodec();
    const started = Date.now();

    const reply = await admin.request(
      '{"cmd":"itest-sum"}',
      sc.encode('not json'),
      { timeout: 5000 },
    );

    expect(Date.now() - started).toBeLessThan(1000);
    expect(JSON.parse(sc.decode(reply.data))).toEqual({
      err: { status: 'error', message: 'Invalid JSON payload' },
      isDisposed: true,
    });
  });

  it('by default leaves a failed message unsettled, so it is redelivered after ackWait', async () => {
    await boot();
    await lastValueFrom(client.emit('itest.fail', { id: 2 }));

    expect(await waitFor(() => deliveries.fail.length >= 2, 10000)).toBe(true);
    const [first, second] = deliveries.fail;
    expect(second.redeliveryCount).toBe(2);
    // Redelivered by ackWait (1s), not by an immediate nak.
    expect(second.at - first.at).toBeGreaterThanOrEqual(900);
  });

  it('naks a failed message with the configured delay', async () => {
    await boot({
      consumerOptions: { ackWait: 30000 },
      eventHandlerError: { action: 'nak', nakDelay: 1500 },
    });
    await lastValueFrom(client.emit('itest.fail', { id: 3 }));

    expect(await waitFor(() => deliveries.fail.length >= 2, 10000)).toBe(true);
    const [first, second] = deliveries.fail;
    expect(second.redeliveryCount).toBe(2);
    expect(second.at - first.at).toBeGreaterThanOrEqual(1400);
    // Well before ackWait would have redelivered it.
    expect(second.at - first.at).toBeLessThan(10000);
  });

  it('terminates a failed message with action term', async () => {
    await boot({ eventHandlerError: { action: 'term' } });
    await lastValueFrom(client.emit('itest.fail', { id: 4 }));

    expect(await waitFor(() => deliveries.fail.length === 1, 5000)).toBe(true);
    // ackWait is 1s, so an unsettled message would be back by now.
    await sleep(3000);
    expect(deliveries.fail).toHaveLength(1);
  });

  it('updates an existing stream that is beyond the first page of the listing', async () => {
    // The stream listing returns 256 streams per page.
    const fillers = 257;
    for (let i = 0; i < fillers; i++) {
      await jsm.streams.add({
        name: `${RUN}-filler-${String(i).padStart(3, '0')}`,
        subjects: [`${RUN}.filler.${i}`],
        storage: StorageType.Memory,
      });
    }
    // Sorts after every filler, so it lands on the second page.
    const target = `${RUN}-zz-target`;
    await jsm.streams.add({
      name: target,
      subjects: [`${RUN}.target.a`],
      storage: StorageType.Memory,
    });
    const firstPage = await jsm.streams.list().next();
    expect(firstPage.map((s) => s.config.name)).not.toContain(target);

    const server = new NatsJetStreamServer({
      connectionOptions: { servers: NATS_URL, name: `${RUN}-paging` },
      consumerOptions: {},
      streamConfig: { name: target, subjects: [`${RUN}.target.b`] },
    });
    await new Promise<void>((resolve) => server.listen(() => resolve()));
    await server.close();

    const info = await jsm.streams.info(target);
    expect(info.config.subjects.sort()).toEqual(
      [`${RUN}.target.a`, `${RUN}.target.b`].sort(),
    );
  });
  // Restarts the NATS server, so it only runs when the test is told which
  // Docker container that is (NATS_CONTAINER). CI sets it.
  const itWithContainer = process.env.NATS_CONTAINER ? it : it.skip;
  itWithContainer(
    'reports a NATS restart through status and on(), and keeps consuming',
    async () => {
      // A file-backed stream survives the restart; a memory stream would not.
      await boot({}, StorageType.File);
      const seen: string[] = [];
      const events: string[] = [];
      server.status.subscribe((s) => seen.push(s));
      server.on('disconnect', () => events.push('disconnect'));
      server.on('reconnect', () => events.push('reconnect'));
      expect(server.unwrap<NatsConnection>().isClosed()).toBe(false);

      execFileSync('docker', ['restart', process.env.NATS_CONTAINER]);

      expect(await waitFor(() => events.includes('reconnect'), 30000)).toBe(
        true,
      );
      expect(seen).toEqual(
        expect.arrayContaining(['connected', 'disconnected']),
      );
      expect(seen[seen.length - 1]).toBe('connected');
      expect(events.slice(0, 1)).toEqual(['disconnect']);

      await lastValueFrom(client.emit('itest.ok', { id: 5 }));
      expect(await waitFor(() => deliveries.ok.length === 1, 10000)).toBe(true);
    },
  );
});
