import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  NatsJetStreamTransport,
  NatsJetStreamClient,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';

@Module({
  imports: [
    NatsJetStreamTransport.register({
      connectionOptions: {
        name: 'myservice-publisher',
        connectedHook: (nc) => console.log('From hook: publisher connected to ', nc.getServer()),
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService, NatsJetStreamClient],
})
export class AppModule {}
