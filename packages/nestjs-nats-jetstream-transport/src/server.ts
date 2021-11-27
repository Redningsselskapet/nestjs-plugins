import {
  CustomTransportStrategy,
  MessageHandler,
  Server,
  WritePacket,
} from "@nestjs/microservices";
import {
  Codec,
  connect,
  NatsConnection,
  StringCodec,
  SubscriptionOptions,
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
  private sc: Codec<string>;

  constructor(private options: NatsJetStreamServerOptions) {
    super();
    this.sc = StringCodec();
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

  private createConsumerOptions(subject: string) {
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
    console.log(eventHandlers);
    eventHandlers.forEach(async ([subject, eventHandler]) => {
      const consumerOption = this.createConsumerOptions(subject);
      const subscription = await js.subscribe(subject, consumerOption);
      this.logger.log(`Subscribed to ${subject} events`);
      for await (const msg of subscription) {
        const data = JSON.parse(this.sc.decode(msg.data));
        const context = new NatsJetStreamContext([msg]);
        this.send(from(eventHandler(data, context)), () => null);
      }
    });
  }

  private filterEventHandlers(): [string, MessageHandler<string, any>][] {
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
          const payload = JSON.parse(this.sc.decode(msg.data));
          const context = new NatsContext([msg]);
          const response$ = this.transformToObservable(
            messageHandler(payload, context)
          );
          return this.send(response$, (response) =>
            msg.respond(this.sc.encode(JSON.stringify(response)))
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
