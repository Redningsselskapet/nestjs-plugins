import { CustomTransportStrategy, Server } from "@nestjs/microservices";
import { Codec, connect, NatsConnection, StringCodec } from "nats";
import { NatsJetStreamServerOptions } from "./interfaces";
import { NatsJetStreamContext } from "./nats-jetstream.context";
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
    const subjects = Array.from(this.messageHandlers.keys());

    if (!subjects) {
      this.logger.log("No message handlers registered");
    }

    subjects.forEach(async (subject): Promise<void> => {
      const js = this.nc.jetstream();
      const opts = this.createConsumerOptions(subject);
      const handler = this.getHandlerByPattern(subject);
      const subscription = await js.subscribe(subject, opts);
      this.logger.log(`Subscribed to ${subject}`);
      for await (const msg of subscription) {
        const data = JSON.parse(this.sc.decode(msg.data));
        const context = new NatsJetStreamContext([msg]);
        this.send(from(handler(data, context)), () => null);
      }
    });
  }
}
