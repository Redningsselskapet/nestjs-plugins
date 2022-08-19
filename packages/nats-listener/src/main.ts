// main.js

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomStrategy } from '@nestjs/microservices';
import { NatsJetStreamServer } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Logger } from '@nestjs/common';
import { DebugEvents, Events } from 'nats';

async function bootstrap() {
  const logger = new Logger();
  const options: CustomStrategy = {
    strategy: new NatsJetStreamServer({
      connectionOptions: {
        name: 'myservice-listener',
        connectedHook: async (nc) => {
          logger.log('Connected to ' + nc.getServer());
          for await (const s of nc.status()) {
            if (s.type == DebugEvents.PingTimer) {
              console.log('We got ping timer attempt: ' + s.data);
            }
          }
        },
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
