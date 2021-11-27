// app.controller.ts

import { NatsContext } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { NatsJetStreamContext } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Controller, Get } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { AppService } from './app.service';
import { ORDER_CREATED, ORDER_DELETED, ORDER_UPDATED } from './constants';
import { StringCodec } from 'nats';
import {
  firstValueFrom,
  lastValueFrom,
  map,
  Observable,
  subscribeOn,
} from 'rxjs';
import { Response } from '@nestjs/common';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  home(): string {
    return 'Welcome to webshop';
  }

  @Get('/create')
  createOrder(): string {
    return this.appService.createOrder();
  }

  @Get('/update')
  updateOrder(): string {
    return this.appService.updateOrder();
  }

  @Get('/sum')
  async deleteOrder() {
    const sum = await firstValueFrom(
      this.appService.accumulate([1, 2, 3]),
    ).finally(() => {
      console.log('finnish');
    });
    console.log(sum);
    return { sum };
  }
  @EventPattern(ORDER_UPDATED)
  public async orderUpdatedHandler(
    @Payload() data: string,
    @Ctx() context: NatsJetStreamContext,
  ) {
    context.message.ack();
    console.log('update received: ' + context.message.subject, data);
  }

  @EventPattern(ORDER_CREATED)
  public async orderCreatedHandler(
    @Payload() data: { id: number; name: string },
    @Ctx() context: NatsJetStreamContext,
  ) {
    context.message.ack();
    console.log('created received: ' + context.message.subject, data);
  }

  @MessagePattern('sum')
  public orderDeletedHandler(
    @Payload() data: Array<number>,
    @Ctx() context: NatsContext,
  ) {
    console.log('regnemaskinen jobber...');
    context.message.respond(StringCodec().encode(JSON.stringify(data.reduce((a, b) => a + b))));
  }
}
