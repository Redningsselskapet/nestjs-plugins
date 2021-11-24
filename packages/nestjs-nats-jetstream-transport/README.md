# Nats JetStream Transport Module for NestJS

Build Event Driven Microservices Architecture with Nats JetSteam Server and NestJS.

- At-least-once delivery; exactly once within a window
- Store messages and replay by time or sequence
- Wildcard support
- Account aware
- Data at rest encryption
- Cleanse specific messages (GDPR)
- Horizontal scalability
- Persist Streams and replay via Consumers

## Install

```bash
npm i @nestjs/microservices
npm i nats
npm i @nestjs-plugins/nestjs-nats-jetstream-transport
```

## Running Nats Jetstream server in Docker

```bash
docker run -d --name nats-main -p 4222:4222 -p 6222:6222 -p 8222:8222 nats -js -m 8222
```

## Manage nats server from command line

Install cli tool on MacOS

```bash
brew install nats-io/nats-tools/nats
```

For other platforms see [alternative installation methods](https://github.com/nats-io/natscli/releases/).

To try the [code example](#Code-example) below, add a stream to the nats server:

```bash
nats stream add 
```

Enter a stream name e.g. mystream. Then as subjects use `order.* `

For the rest of the choices just press enter and use the defaults.

[Read more about the stream configuration here]()

You are now ready to publish and consume events on the stream. See the [code example](#Code-example) below for a test drive.

## Configuration objects

### NatsJetStreamServerOptions

- **id**: string
- **connectionOptions**: ConnectionOptions 
- **serverConsumerOptions**: ServerConsumerOptions 
- **jetStreamOptions**: JetStreamOption

### NatsJetStreamClientOptions

- **connectionOptions**: ConnectionOptions
- **jetStreamOptions**: JetStreamOptions
- **jetStreamPublishOptions**: JetStreamPublishOptions

### ServerConsumerOptions

- **durable**: boolean (default: false) - Durable subscriptions remember their position even if the client is disconnected.
- **deliveryPolicy**: All | Last | New | ByStartSequence | ByStartTime | last_per_subject (default: All) - Specify where in the stream it wants to start receiving messages.
- **startSequence**: number - If deliveryPolicy is set to ByStartSequence this will specify the sequence number to start on.
- **startAtTimeDelta**: number - If If deliveryPolicy is set to ByStartTime this will specify a delta time in the stream at which to start.
- **startTime**: Date - If deliveryPolicy is set to ByStartTime this will specify the time in the stream at which to start. It will receive the closest available message on or after that time.
- **deliverTo**: string - Queue group, a balanced message delivery across a group of subscribers.
- **deliverToSubject**: string - The subject to deliver observed messages. Not allowed for pull subscriptions. Deliver subject is required for queue subscribing as it configures a subject that all the queue consumers should listen on.
- **ackPolicy**: Explicit | All | None (default: Excplicit ) - How messages should be acknowledged. If an ack is required but is not received within the AckWait window, the message will be redelivered. Excplicit is the only allowed option for pull consumers.
- **ackWait**: number (default: 30000 ) - the time in nanoseconds that the server will wait for an ack for any individual message. If an ack is not received in time, the message will be redelivered.
- **maxAckPending**: number (default: 1024) - The maximum number of messages the subscription will receive without sending back ACKs.
- **replayPolicy**: Instant | All | ByStartSequence | ByStartTime (default: Instant) - The replay policy applies when the deliver policy is `All`, `ByStartSequence` or `ByStartTime` since those deliver policies begin reading the stream at a position other than the end. If the policy is `Original`, the messages in the stream will be pushed to the client at the same rate they were originally received, simulating the original timing of messages. If the policy is `Instant` (the default), the messages will be pushed to the client as fast as possible while adhering to the Ack Policy, Max Ack Pending and the client’s ability to consume those messages.
- **maxDeliver**: number (default: ?) - The maximum number of times a specific message will be delivered. Applies to any message that is re-sent due to ack policy.
- **filterSubject**: string - When consuming from a stream with a wildcard subject, the Filter Subject allows you to select a subset of the full wildcard subject to receive messages from.
- **sample**: number - Sets the percentage of acknowledgements that should be sampled for observability, 0-100
- **idleHeartbeat**: number - If the idle heartbeat period is set, the server will send a status message to the client when the period has elapsed but it has not received any new messages. This lets the client know that it’s still there, but just isn’t receiving messages.
- **flowControl**: boolean - Flow control is another way for the consumer to manage back pressure. Instead of relying on the rate limit, it relies on the pending limits of max messages and/or max bytes. If the server sends the number of messages or bytes without receiving an ack, it will send a status message letting you know it has reached this limit. Once flow control is tripped, the server will not start sending messages again until the client tells the server, even if all messages have been acknowledged.
- **maxwaiting**: number - is the number of outstanding pulls that are allowed on any one consumer. Pulls made that exceeds this limit are discarded.
- **maxMessages**: number -
- **manualAck**: boolean - each individual message must be acknowledged.
- **limit**: number - Used to throttle the delivery of messages to the consumer, in bits per second.
- **description**: string - Description text
- **orderedConsumer**: boolean - a specialized push consumer that puts together flow control, heartbeats, and additional logic to handle message gaps. Ordered consumers cannot operate on a queue and cannot be durable.
- **deliverGroup**: string - when set will only deliver messages to subscriptions matching that group.
- **headersOnly**: boolean - configures the consumer to only deliver existing header and the `Nats-Msg-Size` header, no bodies.

### ConnectionOptions

- **servers**: string | string[] (default: 'localhost:4222') - String or Array of hostport for servers.
- **debug**: boolean (default: false) - If `true`, the client prints protocol interactions to the console. Useful for debugging.
- **name**: string - Connections can be assigned a name which will appear in some of the server monitoring data. This name is not required, but is **highly recommended** as a friendly connection name will help in monitoring, error reporting, debugging, and testing.
- **ignoreClusterUpdates**: boolean - If `true` the client will ignore any cluster updates provided by the server.
- **inboxPrefix**: string - Sets de prefix for automatically created inboxes - `createInbox(prefix)`
- **maxPingOut**: number (default: 2) - Max number of pings the client will allow unanswered before raising a stale connection error.
- **tls**: TlsOption - A configuration object for requiring a TLS connection.
- **noEcho**: boolean (default: false) - The NoEcho option can be useful in BUS patterns where all applications subscribe and publish to the same subject.
- **maxReconnectAttempts**: number (default: 10) - Maximum reconnect attempts per server.
- **pass**: string - Sets the password for a connection.
- **noRandomize**: boolean (default: false) - In order to prevent [*thundering herd*](/developing-with-nats/reconnect/random), most NATS client libraries randomize the servers they attempt to connect to. To disable the randomization process for connect and reconnect, set this to true.
- **pedantic**: boolean (default: false) - mode that performs extra checks on the protocol.
- **pingInterval**: number (default: 5) - Number of milliseconds between client-sent pings.
- **port**: number (default: 4222) - Port number nats server listens on.
- **reconnect**: boolean (default: true) - If false, client will not attempt reconnecting.
- **reconnectJitter**: number - control how long before the NATS client attempts to reconnect to a server it has previously connected.
- **reconnectJitterTLS**: number - control how long before the NATS client attempts to reconnect to a server it has previously connected.
- **reconnectTimeWait**: number - prevents wasting client resources and alleviates a [*thundering herd*](/developing-with-nats/reconnect/random) situation when additional servers are not available.
- reconnectDelayHandler: Generated function - A function that returns the number of millis to wait before the next connection to a server it connected to `()=>number`.
- **timeout**: number (default: 20000) - Number of milliseconds the client will wait for a connection to be established. If it fails it will emit a `connection_timeout` event with a NatsError that provides the hostport of the server where the connection was attempted.
- **token**: string - Sets a authorization token for a connection.
- authenticator: Authenticator (default:  none) - Specifies the authenticator function that sets the client credentials.
- **user**: string - Sets the username for a connection.
- **verbose**: boolean (default: false) - Turns on `+OK` protocol acknowledgements.
- **waitOnFirstConnect**: boolean (default: false) - If `true` the client will fall back to a reconnect mode if it fails its first connection attempt.

### JetStreamOptions

- **apiPrefix**: string - *Not documented!*
- **domain**: string - Sets the domain for JetStream subjects, creating a standard prefix from that domain.
- **timeout**: number - Sets the request timeout for JetStream API calls.

### JetStreamPublishOption

- **ackWait**: number
- **expect**: { lastMsgID: string, lastSequence: number, lastSubjectSequence: number, streamName: string } - require that the last message published on the subject was published to the correct stream.
- **headers**: ?
- **msgID**: string - provide your own unique message ID for every message published.
- **timeout**: number

## Code example

```typescript
// app.module.ts

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NatsJetStreamTransport } from '@nestjs-plugins/nats-jetstream-transport';

@Module({
  imports: [
    NatsJetStreamTransport.register({
      connectionOptions: {
        servers: 'localhost:4222',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

```typescript
// app.service.ts

import {
  NatsJetStreamClientProxy,
} from '@nestjs-plugins/nats-jetstream-transport';
import { Injectable } from '@nestjs/common';

interface OrderCreatedEvent {
  id: number;
  product: string;
  quantity: number;
}
interface OrderUpdatedEvent {
  id: number;
  quantity: number;
}
interface OrderDeleteEvent {
  id: number;
}

const ORDER_CREATED = 'order.created';
const ORDER_UPDATED = 'order.updated';
const ORDER_DELETED = 'order.deleted';

@Injectable()
export class AppService {
  constructor(private client: NatsJetStreamClientProxy) {}

  createOrder(): string {
    this.client
      .emit<PubAck, OrderCreatedEvent>(ORDER_CREATED, {
        id: 1,
        product: 'Socks',
        quantity: 1,
      })
      .subscribe((pubAck) => {
        console.log(pubAck);
      });
    return 'order created.';
  }

  updateOrder(): string {
    this.client
      .emit<null, OrderUpdatedEvent>(ORDER_UPDATED, { id: 1, quantity: 10 })
      .subscribe();
    return 'order updated';
  }

  deleteOrder(): string {
    this.client
      .send<PubAck, OrderDeleteEvent>(ORDER_DELETED, { id: 1 })
      .subscribe((pubAck) => {
        console.log(pubAck.seq);
      });
    return 'order deleted';
  }
}
```

```typescript
// app.controller.ts

import { NatsJetStreamContext } from '@nestjs-plugins/nats-jetstream-transport';
import { Controller, Get } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
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
    console.log('received: ' + context.message.subject, data);
  }

  @EventPattern('order.created')
  public async orderCreatedHandler(
    @Payload() data: { id: number; name: string },
    @Ctx() context: NatsJetStreamContext,
  ) {
    context.message.ack();
    console.log('received: ' + context.message.subject, data);
  }

  @EventPattern('order.deleted')
  public async orderDeletedHandler(
    @Payload() data:any,
    @Ctx() context: NatsJetStreamContext,
  ) {
    context.message.ack();
    console.log('received: ' + context.message.subject, data);
  }
}
```

```typescript
// main.js

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomStrategy } from '@nestjs/microservices';
import { NatsJetStreamServer } from '@nestjs-plugins/nats-jetstream-transport';

async function bootstrap() {
  const options: CustomStrategy = {
    strategy: new NatsJetStreamServer({
      id: 'test-service',
      connectionOptions: {},
      consumerOptions: {
        deliverGroup: 'test-service',
        durable: true,
        deliverTo: 'myservice-inbox',
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
```
