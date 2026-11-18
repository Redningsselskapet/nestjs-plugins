import { serverConsumerOptionsBuilder } from './server-consumer-options-builder';

// The builder's state is not part of the public nats typings.
const built = (
  subject: string,
  options: Parameters<typeof serverConsumerOptionsBuilder>[0],
) => serverConsumerOptionsBuilder(options, subject) as any;

describe('serverConsumerOptionsBuilder', () => {
  describe('durable names', () => {
    // These names identify consumers that already exist on deployed servers.
    // Changing any of them orphans the old consumer and replays the stream.
    it.each([
      ['order.created', 'svc-order_created'],
      ['order.*', 'svc-order__ALL'],
      ['order.>', 'svc-order__ALL'],
      ['a.*.b.>', 'svc-a__ALL_b__ALL'],
      ['plain', 'svc-plain'],
    ])('maps %s to %s', (subject, expected) => {
      expect(built(subject, { durable: 'svc' }).config.durable_name).toBe(
        expected,
      );
    });

    it('keeps the durable that rs-marine-services.aistracker runs in production', () => {
      expect(
        built('aisdata.imported', { durable: 'aistracker-api-durable' }).config
          .durable_name,
      ).toBe('aistracker-api-durable-aisdata_imported');
    });

    it('sets no durable name when durable is not given', () => {
      expect(built('order.created', {}).config.durable_name).toBeUndefined();
    });
  });

  it('maps the options a typical service sets', () => {
    const opts = built('order.created', {
      deliverGroup: 'group',
      deliverToSubject: 'deliver.here',
      manualAck: true,
      ackPolicy: 'Explicit',
      ackWait: 30000,
      maxDeliver: 1000,
    });

    expect(opts.mack).toBe(true);
    expect(opts.config).toMatchObject({
      deliver_group: 'group',
      deliver_subject: 'deliver.here',
      ack_policy: 'explicit',
      ack_wait: 30000 * 1_000_000,
      max_deliver: 1000,
    });
  });

  it('creates an inbox under the deliverTo prefix', () => {
    expect(
      built('order.created', { deliverTo: 'svc-messages' }).config
        .deliver_subject,
    ).toMatch(/^svc-messages\./);
  });
});
