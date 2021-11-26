// app.controller.ts

import { NatsJetStreamContext } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Controller, Get } from '@nestjs/common';
import { Ctx, EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  home(): string {
    return 'Welcome to webshop'
  }

  @Get('/create')
  createOrder(): string {
    return this.appService.createOrder();
  }

  @Get('/update')
  updateOrder(): string {
    return this.appService.updateOrder();
  }

  @Get('/delete')
  deleteOrder(): string {
    return this.appService.deleteOrder();
  }

  @EventPattern('order.updated')
  public async orderUpdatedHandler(
    @Payload() data: string,
    @Ctx() context: NatsJetStreamContext,
  ) {
    context.message.ack();
    console.log('update received: ' + context.message.subject, data);
  }

  @EventPattern('order.created')
  public async orderCreatedHandler(
    @Payload() data: { id: number; name: string },
    @Ctx() context: NatsJetStreamContext,
  ) {
    context.message.ack();
    console.log('created received: ' + context.message.subject, data);
  }

  @MessagePattern('order.deleted')
  public async orderDeletedHandler(
    @Payload() data:any,
    @Ctx() context: NatsJetStreamContext,
  ) {
    context.message.ack();
    console.log('deleted received: ' + context.message.subject, data);
  }
}
