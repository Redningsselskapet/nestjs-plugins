import { ConnectionOptions, JetStreamOptions } from "nats";
import { ServerConsumerOptions } from "./server-consumer-options.interface";

export interface NatsJetStreamServerOptions {
  connectionOptions: ConnectionOptions & Pick<ConnectionOptions, 'name'>;
  consumerOptions: Partial<ServerConsumerOptions>;
  jetStreamOptions?: JetStreamOptions;
}

