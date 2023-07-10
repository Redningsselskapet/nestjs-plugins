import { RequestOptions, headers } from 'nats';

export class NatsRequestRecord<TData = any> {
  constructor(
    public readonly payload: TData,
    public readonly options: RequestOptions,
  ) {}
}

export class NatsRequestOptionsBuilder<TData = any> {
  private options: RequestOptions = {
    timeout: 1000,
  };
  constructor(private payload?: TData) {}

  appendHeader(key: string, value: string) {
    this.options.headers = this.options.headers || headers();
    this.options.headers.append(key, value);
  }

  build(): NatsRequestRecord<TData> {
    return new NatsRequestRecord<TData>(this.payload, this.options);
  }

  setPayload(payload: TData) {
    this.payload = payload;
  }

  setReplyToSubject(replyTo: string) {
    this.options.reply = replyTo;
    this.options.noMux = true;
  }

  setTimeout(value: number) {
    this.options.timeout = value;
  }

  setNoMux(value: boolean) {
    this.options.noMux = value;
  }
}
