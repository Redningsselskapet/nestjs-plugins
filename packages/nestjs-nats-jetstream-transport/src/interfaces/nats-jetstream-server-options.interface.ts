import { ConnectionOptions, JetStreamOptions } from "nats";
import { ServerConsumerOptions } from "./server-consumer-options.interface";

export interface NatsJetStreamServerOptions {
  id: string;
  connectionOptions: ConnectionOptions;
  consumerOptions: Partial<ServerConsumerOptions>;
  jetStreamOptions?: JetStreamOptions;
}

