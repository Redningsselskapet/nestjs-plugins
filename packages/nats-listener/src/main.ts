// main.js

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomStrategy } from '@nestjs/microservices';
import { NatsJetStreamServer } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { StorageType } from 'nats';

async function bootstrap() {
  const options: CustomStrategy = {
    strategy: new NatsJetStreamServer({
      connectionOptions: {
        servers: 'localhost',
        name: 'myservice-listener',
      },
      consumerOptions: {
        deliverGroup: 'myservice-group',
        durable: 'myservice',
        deliverTo: 'test-service',
        manualAck: true,
      },
      streamConfig: {
        name: 'my-stream',
        subjects: ['order.*'],
        storage: StorageType.Memory,
      },
    }),
  };

  const app = await NestFactory.create(AppModule);
  const microService = app.connectMicroservice(options);
  await microService.listen();
}

// noinspection JSIgnoredPromiseFromCall
bootstrap();
