// main.js

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomStrategy } from '@nestjs/microservices';
import { NatsJetStreamServer } from '@nestjs-plugins/nestjs-nats-jetstream-transport';

async function bootstrap() {
  const options: CustomStrategy = {
    strategy: new NatsJetStreamServer({
      connectionOptions: {
        name: 'myservice-listener',
      },
      consumerOptions: {
        deliverGroup: 'myservice-group',
        durable: 'myservice-durable',
        deliverTo: 'myservice-messages',
        manualAck: true,
      },
      streamConfig: {
        name: 'mystream',
        subjects: ['order.*'],
      },
    }),
  };

  const app = await NestFactory.create(AppModule);
  const microService = app.connectMicroservice(options);
  await microService.listen();
}

// noinspection JSIgnoredPromiseFromCall
bootstrap();
