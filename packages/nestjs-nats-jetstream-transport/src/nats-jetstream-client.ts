import { Injectable } from "@nestjs/common";
import { PubAck } from "nats";
import { Observable } from "rxjs";
import { NatsJetStreamClientProxy } from "./client";

@Injectable()
export class NatsJetStreamClient {
  constructor(private client: NatsJetStreamClientProxy) {}
  emit<TInput>(pattern: any, data: TInput): Observable<PubAck> {
    return this.client.emit<PubAck, TInput>(pattern, data);
  }
  send<TInput>(pattern: any, data: TInput): Observable<PubAck> {
    return this.client.send<PubAck, TInput>(pattern, data);
  }
  connect() {
    this.connect();
  }
  close() {
    this.close();
  }
}
