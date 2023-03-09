import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import {
  Codec,
  connect,
  JetStreamManager,
  JSONCodec,
  NatsConnection,
  SubscriptionOptions,
} from 'nats';

import { from } from 'rxjs';
import { NATS_JETSTREAM_TRANSPORT } from './constants';
import { NatsJetStreamServerOptions } from './interfaces/nats-jetstream-server-options.interface';
import { NatsContext, NatsJetStreamContext } from './nats-jetstream.context';
import { serverConsumerOptionsBuilder } from './utils/server-consumer-options-builder';

export class NatsJetStreamServer
  extends Server
  implements CustomTransportStrategy
{
  readonly transportId: symbol = NATS_JETSTREAM_TRANSPORT;
  private nc: NatsConnection;
  private codec: Codec<JSON>;
  private jsm: JetStreamManager;

  constructor(private options: NatsJetStreamServerOptions) {
    super();
    this.codec = JSONCodec();
  }

  async listen(callback: () => null) {
    if (!this.nc) {
      this.nc = await connect(this.options.connectionOptions);
      if (this.options.connectionOptions.connectedHook) {
        this.options.connectionOptions.connectedHook(this.nc);
      }
    }
    this.jsm = await this.nc.jetstreamManager(this.options.jetStreamOptions);
    if (this.options.streamConfig) {
      await this.setupStream();
    }

    await this.bindEventHandlers();
    this.bindMessageHandlers();
    callback();
  }

  async close() {
    await this.nc.drain();
    this.nc = undefined;
  }

  private async bindEventHandlers() {
    const eventHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => handler.isEventHandler,
    );

    const js = this.nc.jetstream(this.options.jetStreamOptions);

    for (const [subject, eventHandler] of eventHandlers) {
      const consumerOptions = serverConsumerOptionsBuilder(
        this.options.consumerOptions,
        subject,
      );
      const subscription = await js.subscribe(subject, consumerOptions);
      this.logger.log(`Subscribed to ${subject} events`);
      const done = (async () => {
        for await (const msg of subscription) {
          try {
            const data = this.codec.decode(msg.data);
            const context = new NatsJetStreamContext([msg]);
            this.send(from(eventHandler(data, context)), () => null);
          } catch (err) {
            this.logger.error(err.message, err.stack);
            // specifies that you failed to process the server and instructs
            // the server to not send it again (to any consumer)
            msg.term();
          }
        }
      })();
      done.then(() => {
        // if the connection is closed or draining, we don't need to unsubscribe as the subscription will be unsubscribed automatically
        if (this.nc.isDraining() || this.nc.isClosed()) {
          return;
        }
        subscription.destroy();

        this.logger.log(`Unsubscribed ${subject}`);
      });
    }
  }

  private bindMessageHandlers() {
    const messageHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => !handler.isEventHandler,
    );

    for (const [subject, messageHandler] of messageHandlers) {
      const subscriptionOptions: SubscriptionOptions = {
        queue: this.options.consumerOptions.deliverTo,
        callback: async (err, msg) => {
          if (err) {
            return this.logger.error(err.message, err.stack);
          }
          const payload = this.codec.decode(msg.data);
          const context = new NatsContext([msg]);
          const response$ = this.transformToObservable(
            messageHandler(payload, context),
          );
          this.send(response$, (response) =>
            msg.respond(this.codec.encode(response as JSON)),
          );
        },
      };

      this.nc.subscribe(subject, subscriptionOptions);
      this.logger.log(`Subscribed to ${subject} messages`);
    }
  }

  private async setupStream() {
    const { streamConfig } = this.options;
    const streams = await this.jsm.streams.list().next();
    const stream = streams.find(
      (stream) => stream.config.name === streamConfig.name,
    );

    if (stream) {
      const streamSubjects = new Set([
        ...stream.config.subjects,
        ...streamConfig.subjects,
      ]);

      const streamInfo = await this.jsm.streams.update(stream.config.name, {
        ...stream.config,
        ...streamConfig,
        subjects: [...streamSubjects.keys()],
      });
      this.logger.log(`Stream ${streamInfo.config.name} updated`);
    } else {
      const streamInfo = await this.jsm.streams.add(streamConfig);
      this.logger.log(`Stream ${streamInfo.config.name} created`);
    }
  }
}
