// app.service.ts

import { NatsJetStreamClientProxy } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Injectable } from '@nestjs/common';
import { PubAck, StringCodec } from 'nats';
import { map, Observable, switchMap, tap } from 'rxjs';
import { ORDER_CREATED, ORDER_DELETED, ORDER_UPDATED } from './constants';

interface OrderCreatedEvent {
  id: number;
  product: string;
  quantity: number;
}
interface OrderUpdatedEvent {
  id: number;
  quantity: number;
}
interface OrderDeleteEvent {
  id: number;
}

@Injectable()
export class AppService {
  constructor(private client: NatsJetStreamClientProxy) {}

  createOrder(): string {
    this.client
      .emit<PubAck, OrderCreatedEvent>(ORDER_CREATED, {
        id: 1,
        product: 'Socks',
        quantity: 1,
      })
      .subscribe((pubAck) => console.log('order create event sent'));
    return 'order created.';
  }

  updateOrder(): string {
    this.client
      .emit<PubAck, OrderUpdatedEvent>(ORDER_UPDATED, { id: 1, quantity: 10 })
      .subscribe((pubAck) => console.log('order update event sent'));
    return 'order updated';
  }

  deleteOrder(): string {
    this.client
      .send<any, { a: number; b: number }>(ORDER_DELETED, { a: 1, b: 200 })
      .subscribe((r) => console.log(r));
    return 'sending deleted';
  }

  accumulate(payload: number[]): Observable<number> {
    const pattern = { cmd: 'sum' };
    return this.client.send<number>(pattern, payload);
  }
}
