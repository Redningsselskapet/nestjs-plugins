import { Injectable } from '@nestjs/common';
import { NatsConnection, PubAck } from 'nats';
import { Observable } from 'rxjs';
import { NatsJetStreamClientProxy } from './client';

@Injectable()
export class NatsJetStreamClient {
  constructor(private client: NatsJetStreamClientProxy) {}
  emit<TInput>(pattern: any, data: TInput): Observable<PubAck> {
    return this.client.emit<PubAck, TInput>(pattern, data);
  }
  send<TInput>(pattern: any, data: TInput): Observable<PubAck> {
    return this.client.send<PubAck, TInput>(pattern, data);
  }
  async connect(): Promise<NatsConnection> {
    return this.client.connect();
  }
  async close(): Promise<void> {
    return this.client.close();
  }
}
