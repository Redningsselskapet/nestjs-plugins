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
import { Observable } from 'rxjs';
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
  deleteOrder() {
    this.appService.accumulate().subscribe(sum => {
      console.log(sum)
    })
    
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
      context.message.respond(StringCodec().encode(JSON.stringify(data[0]+data[1]+data[2])));
  }
}
