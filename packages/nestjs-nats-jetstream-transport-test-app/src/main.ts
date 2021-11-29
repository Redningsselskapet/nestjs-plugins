// main.js

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomStrategy } from '@nestjs/microservices';
import { NatsJetStreamServer } from '@nestjs-plugins/nestjs-nats-jetstream-transport';

async function bootstrap() {
  const options: CustomStrategy = {
    strategy: new NatsJetStreamServer({
      connectionOptions: {},
      consumerOptions: {
        deliverGroup: 'test-service-group',
        durable: 'myservice',
        deliverTo: 'test-service',
        manualAck: true,
      },
    }),
  };

  // hybrid microservice and web application
  const app = await NestFactory.create(AppModule);
  const microService = app.connectMicroservice(options);
  microService.listen();
  app.listen(3000);
}
bootstrap();
