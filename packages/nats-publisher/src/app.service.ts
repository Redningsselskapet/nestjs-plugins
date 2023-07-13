import {
  NatsJetStreamRecordBuilder,
  NatsRequestOptionsBuilder,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import {
  NatsJetStreamClientProxy,
  NatsJetStreamRecord,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Injectable } from '@nestjs/common';
import { Events, JetStreamPublishOptions, PubAck, headers } from 'nats';
import { async } from 'rxjs';

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

const ORDER_CREATED = 'order.created';
const ORDER_UPDATED = 'order.updated';
const ORDER_DELETED = 'order.deleted';

@Injectable()
export class AppService {
  constructor(private client: NatsJetStreamClientProxy) {
    client.connect().then(async (nc) => {
      for await (const s of nc.status()) {
        console.log(s);
      }
    });
  }

  createOrder(): string {
    const recordBuilder = new NatsJetStreamRecordBuilder<OrderCreatedEvent>({
      id: 1,
      product: 'NestJS',
      quantity: 10,
    });

    //recordBuilder.setMsgId('123');
    recordBuilder.setExpectations({
      streamName: 'mystream',
    });
    recordBuilder.appendHeader('x-custom-header', 'custom-header-value');
    const record = recordBuilder.build();

    this.client.emit(ORDER_CREATED, record).subscribe((pubAck) => {
      console.log(pubAck);
    });
    return 'order created.';
  }

  updateOrder(): string {
    this.client
      .emit<OrderUpdatedEvent>(ORDER_UPDATED, { id: 1, quantity: 10 })
      .subscribe();
    return 'order updated';
  }

  deleteOrder(): string {
    this.client.emit<OrderDeleteEvent>(ORDER_DELETED, { id: 1 }).subscribe({
      next: (pubAck) => console.log(pubAck),
      error: (err) => console.log(err),
    });
    return 'order deleted';
  }

  // request - response
  accumulate(payload: number[]) {
    const pattern = { cmd: 'sum' };

    const builder = new NatsRequestOptionsBuilder();
    builder.setPayload(payload);
    builder.appendHeader('x-custom-header', 'custom-header-value');
    builder.setReplyToSubject('price-calculation');
    builder.setTimeout(1000);
    builder.setNoMux(true);
    const record = builder.build();

    this.client.send<number[]>(pattern, record).subscribe({
      next: (value) => console.log(value),
      error: (error) => console.log(error),
    });
  }
}
