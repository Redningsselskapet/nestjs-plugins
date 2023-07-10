import { NatsJetStreamContext } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Controller, Get } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { AppService } from './app.service';

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

  @Get('/delete')
  deleteOrder(): string {
    return this.appService.deleteOrder();
  }

  // request - response
  @Get('/sum')
  calc() {
    console.log('sum controller');
    return this.appService.accumulate([1, 2, 3]);
  }

  @EventPattern('order.updated')
  public async orderUpdatedHandler(
    @Payload() data: string,
    @Ctx() context: NatsJetStreamContext,
  ) {
    context.message.ack();
    console.log('received: ' + context.message.subject, data);
  }

  @EventPattern('order.created')
  public async orderCreatedHandler(
    @Payload() data: { id: number; name: string },
    @Ctx() context: NatsJetStreamContext,
  ) {
    console.log(context.message.headers);
    console.log(context.message.info);
    context.message.ack();
    console.log('received: ' + context.message.subject, data);
  }

  @EventPattern('order.deleted')
  public async orderDeletedHandler(
    @Payload() data: any,
    @Ctx() context: NatsJetStreamContext,
  ) {
    context.message.ack();
    console.log('received: ' + context.message.subject, data);
  }

  // request - response
  @MessagePattern({ cmd: 'sum' })
  async accumulate(
    @Payload() data: number[],
    @Ctx() context: NatsJetStreamContext,
  ): Promise<number> {
    console.log(context.message.headers);
    console.log('message conroller', data);
    return (data || []).reduce((a, b) => a + b);
  }

  @MessagePattern('price-calculation')
  async koko(
    @Payload() data: number[],
    @Ctx() context: NatsJetStreamContext,
  ): Promise<number> {
    console.log('price-calculation', data);
    return;
  }
}
