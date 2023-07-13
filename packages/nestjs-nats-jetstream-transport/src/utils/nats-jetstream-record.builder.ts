import { JetStreamPublishOptions, MsgHdrs, headers } from 'nats';

export class NatsJetStreamRecord<TData = any> {
  constructor(
    public readonly payload: TData,
    public readonly options: Partial<JetStreamPublishOptions>,
  ) {}
}

export class NatsJetStreamRecordBuilder<TData = any> {
  private options: Partial<JetStreamPublishOptions> = {};
  constructor(private payload?: TData) {}

  setMsgId(msgId: string) {
    this.options.msgID = msgId;
  }

  getMsgId(): string {
    return this.options.msgID;
  }

  appendHeader(key: string, value: string) {
    this.options.headers = this.options.headers || headers();
    this.options.headers.append(key, value);
  }

  build(): NatsJetStreamRecord<TData> {
    return new NatsJetStreamRecord<TData>(this.payload, this.options);
  }

  setExpectations(expect: Partial<JetStreamPublishOptions['expect']>) {
    this.options.expect = expect;
  }

  setPayload(payload: TData) {
    this.payload = payload;
  }
}
