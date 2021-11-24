// app.module.ts

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NatsJetStreamTransport } from '@nestjs-plugins/nestjs-nats-jetstream-transport';

@Module({
  imports: [
    NatsJetStreamTransport.register({
      connectionOptions: {
        servers: '127.0.0.1'
      }
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
