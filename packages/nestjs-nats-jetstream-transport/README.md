# 🚀 Nats JetStream Transport Module for NestJS

Build Event Driven Microservices Architecture with Nats JetStream Server and NestJS.

- At-least-once delivery; exactly once within a window
- Store messages and replay by time or sequence
- Wildcard support
- Account aware
- Data at rest encryption
- Cleanse specific messages (GDPR)
- Horizontal scalability
- Persist Streams and replay via Consumers

> Support for both request-response and event based pattern.

## 📦 Install

```bash
npm i @nestjs/microservices
npm i nats
npm i @nestjs-plugins/nestjs-nats-jetstream-transport
```

## 🐳 Running Nats Jetstream server in Docker

```bash
docker run -d --name nats-main -p 4222:4222 -p 6222:6222 -p 8222:8222 nats -js -m 8222
```

## ⚙️ Manage nats server from command line

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

> You can also automatically create a stream by defining a streamConfig object to the NatsJestStreamOptions object.
> This will create a new stream or update existing.
> The code example bellow has this object defined so there is not really necessary to add this stream through nats cli.

You are now ready to publish and consume events on the stream. See the [code example](#Code-example) below for a test drive.

## 📖 Description - configuration objects

### NatsJetStreamServerOptions

- **connectionOptions**: NatsConnectionOptions
- **serverConsumerOptions**: ServerConsumerOptions
- **jetStreamOptions**: JetStreamOption
- **streamConfig**: NatsStreamConfig - Stream configuration. If defined, create stream if not exist.

### NatsJetStreamClientOptions

- **connectionOptions**: ConnectionOptions
- **jetStreamOptions**: JetStreamOptions

### ServerConsumerOptions

- **durable**: string - Durable subscriptions remember their position even if the client is disconnected.
- **deliveryPolicy**: All | Last | New | ByStartSequence | ByStartTime | last_per_subject (default: All) - Specify where in the stream it wants to start receiving messages.
- **startSequence**: number - If deliveryPolicy is set to ByStartSequence this will specify the sequence number to start on.
- **startAtTimeDelta**: number - If If deliveryPolicy is set to ByStartTime this will specify a delta time in the stream at which to start.
- **startTime**: Date - If deliveryPolicy is set to ByStartTime this will specify the time in the stream at which to start. It will receive the closest available message on or after that time.
- **deliverTo**: string - Creates a unique delivery_subject prefix with this.
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

### NatsConnectionOptions

- **servers**: string | string[] (default: 'localhost:4222') - String or Array of hostport for servers.
- **debug**: boolean (default: false) - If `true`, the client prints protocol interactions to the console. Useful for debugging.
- **name**: string - Connections can be assigned a name which will appear in some of the server monitoring data. This name is not required, but is **highly recommended** as a friendly connection name will help in monitoring, error reporting, debugging, and testing.
- **connectedHook**: function(nc: NatsConnection): void - A hook function that is run after connection is established.
- **ignoreClusterUpdates**: boolean - If `true` the client will ignore any cluster updates provided by the server.
- **inboxPrefix**: string - Sets de prefix for automatically created inboxes - `createInbox(prefix)`
- **maxPingOut**: number (default: 2) - Max number of pings the client will allow unanswered before raising a stale connection error.
- **tls**: TlsOption - A configuration object for requiring a TLS connection.
- **noEcho**: boolean (default: false) - The NoEcho option can be useful in BUS patterns where all applications subscribe and publish to the same subject.
- **maxReconnectAttempts**: number (default: 10) - Maximum reconnect attempts per server.
- **pass**: string - Sets the password for a connection.
- **noRandomize**: boolean (default: false) - In order to prevent [_thundering herd_](/developing-with-nats/reconnect/random), most NATS client libraries randomize the servers they attempt to connect to. To disable the randomization process for connect and reconnect, set this to true.
- **pedantic**: boolean (default: false) - mode that performs extra checks on the protocol.
- **pingInterval**: number (default: 5) - Number of milliseconds between client-sent pings.
- **port**: number (default: 4222) - Port number nats server listens on.
- **reconnect**: boolean (default: true) - If false, client will not attempt reconnecting.
- **reconnectJitter**: number - control how long before the NATS client attempts to reconnect to a server it has previously connected.
- **reconnectJitterTLS**: number - control how long before the NATS client attempts to reconnect to a server it has previously connected.
- **reconnectTimeWait**: number - prevents wasting client resources and alleviates a [_thundering herd_](/developing-with-nats/reconnect/random) situation when additional servers are not available.
- reconnectDelayHandler: Generated function - A function that returns the number of milliseconds to wait before the next connection to a server it connected to `()=>number`.
- **timeout**: number (default: 20000) - Number of milliseconds the client will wait for a connection to be established. If it fails it will emit a `connection_timeout` event with a NatsError that provides the hostport of the server where the connection was attempted.
- **token**: string - Sets a authorization token for a connection.
- **authenticator:** Authenticator (default: none) - Specifies the authenticator function that sets the client credentials.
- **user**: string - Sets the username for a connection.
- **verbose**: boolean (default: false) - Turns on `+OK` protocol acknowledgements.
- **waitOnFirstConnect**: boolean (default: false) - If `true` the client will fall back to a reconnect mode if it fails its first connection attempt.

### JetStreamOptions

- **apiPrefix**: string - _Not documented!_
- **domain**: string - Sets the domain for JetStream subjects, creating a standard prefix from that domain.
- **timeout**: number - Sets the request timeout for JetStream API calls.

### JetStreamPublishOption

- **ackWait**: number
- **expect**: { lastMsgID: string, lastSequence: number, lastSubjectSequence: number, streamName: string } - require that the last message published on the subject was published to the correct stream.
- **headers**: ?
- **msgID**: string - provide your own unique message ID for every message published.
- **timeout**: number

### **NatsStreamConfig**

- **name**: string - Stream name
- **storage?**: StorageType (default: StorageType.File) - The type of storage backend, `File` and `Memory`
- **subjects**: string[] - Array of subjects
- **replicas?**: number - How many replicas to keep for each message in a clustered JetStream, maximum 5.
- **max_age?**: number (default: 0) - Maximum age of any message in the stream, expressed in nanoseconds.
- **max_bytes?**: number - How many bytes the Stream may contain. Adheres to Discard Policy, removing oldest or refusing new messages if the Stream exceeds this size.
- **max_msgs?**: number (default: -1) - How large the Stream may become in total messages before the configured discard policy kicks in.
- **max_msg_size?**: number (default: -1) - The largest message that will be accepted by the Stream.
- **max_consumers?**: number (default: -1) - How many Consumers can be defined for a given Stream, -1 for unlimited.
- **no_ack?**: boolean (default: false) - Disables acknowledging messages that are received by the Stream.
- **retention?**: RetentionPolicy.limits (default: RetentionPolicy.Limits) - How message retention is considered, `Limits`, `Interest` or `WorkQueue`.
- **discard?**: DiscardPolicy (default: DiscardPolicy.Old) - he behavior of discarding messages when any streams' limits have been reached, `old` (delete the oldest messages in order to maintain the limit) or `new` (reject new messages from being appended to the stream if it would exceed one of the limits).
- **duplicate_window?**: number (default: 120000000000) - The window within which to track duplicate messages.
- **placement?**: Placement - Used to declare where the stream should be placed via tags and/or an explicit cluster name.
- **mirror?**: If set, indicates this stream is a mirror of another stream.
- **sources?**: StreamSource - If defined, declares one or more streams this stream will source messages from.
- **max_msgs_per_subject?**: number (default: -1) - Limits how many messages in the stream to retain per subject.
- **description?**: string - Limits how many messages in the stream to retain per subject.
- **sealed?**: Sealed streams do not allow messages to be deleted via limits or API, sealed streams can not be unsealed via configuration update. Can only be set on already created streams via the Update API.
- **deny_delete**: boolean (default: false) - Restricts the ability to delete messages from a stream via the API.
- **deny_purge**: boolean (default: false) - Restricts the ability to purge messages from a stream via the API.
- **allow_rollup**: Allows the use of the Nats-Rollup header to replace all contents of a stream, or subject in a stream, with a single new message.
- **republish**: If set, messages stored to the stream will be immediately republished to the configured subject.
- **allow_direct**: boolean (default: false) - If true, and the stream has more than one replica, each replica will respond to direct get requests for individual messages, not only the leader.
- **mirror_direct**: boolean (default: false) - If true, and the stream is a mirror, the mirror will participate in a serving direct get requests for individual messages from origin stream.
- **discard_new_per_subject**: boolean (default: false) - If true, applies discard new semantics on a per subject basis. Requires DiscardPolicy to be DiscardNew and the MaxMsgsPerSubject to be set.
- **metadata**: A set of application-defined key-value pairs for associating metadata on the stream.
- **compression**: If file-based and a compression algorithm is specified, the stream data will be compressed on disk. Valid options are nothing (empty string) or s2 for Snappy compression.
- **first_seq**: number - If specified, a new stream will be created with it's initial sequence set to this value.
- **subject_transform** - Applies a subject transform (to matching messages) before storing the message.
- **num_replicas?**: number (default:1) - How many replicas to keep for each message in a clustered JetStream, maximum 5.

## Code example

```typescript
// app.module.ts

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NatsJetStreamTransport } from '@nestjs-plugins/nestjs-nats-jetstream-transport';

@Module({
  imports: [
    NatsJetStreamTransport.register({
      connectionOptions: {
        servers: 'localhost:4222',
        name: 'myservice-publisher',
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

```typescript
// app.service.ts

import { NatsJetStreamClientProxy } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { Injectable } from '@nestjs/common';
import { PubAck } from 'nats';
import { Observable } from 'rxjs';

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
      .emit<OrderCreatedEvent>(ORDER_CREATED, {
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
      .emit<OrderUpdatedEvent>(ORDER_UPDATED, { id: 1, quantity: 10 })
      .subscribe();
    return 'order updated';
  }

  deleteOrder(): string {
    this.client
      .emit<OrderDeleteEvent>(ORDER_DELETED, { id: 1 })
      .subscribe((pubAck) => {
        console.log(pubAck);
      });
    return 'order deleted';
  }

  // request - response
  accumulate(payload: number[]): Observable<PubAck> {
    const pattern = { cmd: 'sum' };
    return this.client.send<number[]>(pattern, payload);
  }
}
```

```typescript
// app.controller.ts

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
  async accumulate(data: number[]): Promise<number> {
    console.log('message conroller', data);
    return (data || []).reduce((a, b) => a + b);
  }
}
```

```typescript
// main.js

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomStrategy } from '@nestjs/microservices';
import { NatsJetStreamServer } from '@nestjs-plugins/nestjs-nats-jetstream-transport';

async function bootstrap() {
  const options: CustomStrategy = {
    strategy: new NatsJetStreamServer({
      connectionOptions: {
        servers: 'localhost:4222',
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
      //   streamConfig: [{
      //     name: 'mystream',
      //     subjects: ['order.*'],
      //   },{
      //     name: 'myOtherStream',
      //     subjects: ['other.*'],
      //   }],
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
