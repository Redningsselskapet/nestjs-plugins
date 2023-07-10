import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  NatsJetStreamTransport,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { headers } from 'nats';

@Module({
  imports: [
    NatsJetStreamTransport.register({
      connectionOptions: {
        name: 'myservice-publisher',
        connectedHook: (nc) =>
          console.log('From hook: publisher connected to ', nc.getServer()),
      },
      // jetStreamPublishOptions: {
      //   headers: headers(),
      //   msgID: 'my-message-id',
      //   timeout: 1000,
      //   expect: {
      //     streamName: 'my-stream',
      //     lastSubjectSequence: 0,
        
      // },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
