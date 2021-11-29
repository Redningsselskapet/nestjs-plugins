import {
  CustomTransportStrategy,
  MessageHandler,
  Server,
  WritePacket,
} from "@nestjs/microservices";
import {
  Codec,
  connect,
  ConsumerOptsBuilder,
  NatsConnection,
  StringCodec,
  SubscriptionOptions,
  JSONCodec,
} from "nats";
import { NatsJetStreamServerOptions } from "./interfaces";
import { NatsContext, NatsJetStreamContext } from "./nats-jetstream.context";
import { serverConsumerOptionsBuilder } from "./utils/server-consumer-options-builder";
import { from } from "rxjs";

export class NatsJetStreamServer
  extends Server
  implements CustomTransportStrategy
{
  private nc: NatsConnection;
  private codec: Codec<JSON>;

  constructor(private options: NatsJetStreamServerOptions) {
    super();
    this.codec = JSONCodec();
  }

  async listen(callback: () => null) {
    if (!this.nc) {
      this.nc = await connect(this.options.connectionOptions);
    }

    await this.bindEventHandlers();
    this.bindMessageHandlers();
    callback();
  }

  async close() {
    await this.nc.close();
  }

  // TODO: better naming. All this do is creating durable name and returns a builder.
  private createConsumerOptions(subject: string): ConsumerOptsBuilder {
    const opts = serverConsumerOptionsBuilder(this.options.consumerOptions);
    if (this.options.consumerOptions.durable) {
      opts.durable(
        `${this.options.id}-${subject.replace(".", "_").replace("*", "_ALL")}`
      );
    }
    return opts;
  }

  private async bindEventHandlers() {
    const eventHandlers = this.filterEventHandlers();
    const js = this.nc.jetstream(this.options.jetStreamOptions);

    eventHandlers.forEach(async ([subject, eventHandler]) => {
      const consumerOptions = this.createConsumerOptions(subject);
      const subscription = await js.subscribe(subject, consumerOptions);
      this.logger.log(`Subscribed to ${subject} events`);
      for await (const msg of subscription) {
        try {
          const data = this.codec.decode(msg.data);
          const context = new NatsJetStreamContext([msg]);
          this.send(from(eventHandler(data, context)), () => null);
        } catch (err) {
          this.logger.error(err.message, err.stack);
          // specifies that you failed to process the server and instructs 
          // the server to not send it againn (to any consumer)
          msg.term();
        }
      }
    });
  }

  private filterEventHandlers(): [string, MessageHandler<any, any>][] {
    const eventHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => handler.isEventHandler
    );
    return eventHandlers;
  }

  private bindMessageHandlers() {
    const messageHandlers = this.filterMessageHandlers();
    messageHandlers.forEach(async ([subject, messageHandler]) => {
      const subscriptionOptions: SubscriptionOptions = {
        queue: this.options.consumerOptions.deliverTo,
        callback: async (err, msg) => {
          if (err) {
            return this.logger.error(err.message, err.stack);
          }
          const payload = this.codec.decode(msg.data);
          const context = new NatsContext([msg]);
          const response$ = this.transformToObservable(
            messageHandler(payload, context)
          );
          this.send(response$, (response) =>
            msg.respond(this.codec.encode(response as JSON))
          );
        },
      };
      this.nc.subscribe(subject, subscriptionOptions);
      this.logger.log(`Subscribed to ${subject} messages`);
    });
  }

  private filterMessageHandlers() {
    const eventHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => !handler.isEventHandler
    );
    return eventHandlers;
  }
}
