import {
  NatsJetStreamRecord,
  NatsJetStreamRecordBuilder,
} from './nats-jetstream-record.builder';
import {
  NatsRequestOptionsBuilder,
  NatsRequestRecord,
} from './nats-request-record-builder';

describe('NatsJetStreamRecordBuilder', () => {
  it('builds a record with payload, message id, headers and expectations', () => {
    const builder = new NatsJetStreamRecordBuilder({ id: 1 });
    builder.setMsgId('msg-1');
    builder.appendHeader('x-a', '1');
    builder.appendHeader('x-a', '2');
    builder.setExpectations({ streamName: 'orders' });

    const record = builder.build();

    expect(record).toBeInstanceOf(NatsJetStreamRecord);
    expect(record.payload).toEqual({ id: 1 });
    expect(builder.getMsgId()).toBe('msg-1');
    expect(record.options.msgID).toBe('msg-1');
    expect(record.options.headers.values('x-a')).toEqual(['1', '2']);
    expect(record.options.expect).toEqual({ streamName: 'orders' });
  });

  it('builds a record with empty options when nothing is set', () => {
    const record = new NatsJetStreamRecordBuilder().build();
    expect(record.payload).toBeUndefined();
    expect(record.options).toEqual({});
  });

  it('uses the payload set later', () => {
    const builder = new NatsJetStreamRecordBuilder<number>(1);
    builder.setPayload(2);
    expect(builder.build().payload).toBe(2);
  });
});

describe('NatsRequestOptionsBuilder', () => {
  it('defaults to a 1000 ms timeout', () => {
    const record = new NatsRequestOptionsBuilder([1, 2]).build();
    expect(record).toBeInstanceOf(NatsRequestRecord);
    expect(record.payload).toEqual([1, 2]);
    expect(record.options).toEqual({ timeout: 1000 });
  });

  it('sets timeout, headers, reply subject and noMux', () => {
    const builder = new NatsRequestOptionsBuilder();
    builder.setPayload('x');
    builder.setTimeout(5000);
    builder.appendHeader('x-a', '1');
    builder.setReplyToSubject('reply.here');

    const record = builder.build();

    expect(record.payload).toBe('x');
    expect(record.options.timeout).toBe(5000);
    expect(record.options.headers.get('x-a')).toBe('1');
    expect(record.options.reply).toBe('reply.here');
    expect(record.options.noMux).toBe(true);

    builder.setNoMux(false);
    expect(builder.build().options.noMux).toBe(false);
  });
});
