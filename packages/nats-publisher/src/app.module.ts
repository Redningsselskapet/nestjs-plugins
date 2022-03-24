import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NatsJetStreamTransport, Publisher } from '@nestjs-plugins/nestjs-nats-jetstream-transport';

@Module({
  imports: [
    NatsJetStreamTransport.register({
      connectionOptions: {
        name: 'myservice-publisher',
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService, Publisher],
})
export class AppModule {}
