import { JetStreamOptions, StreamConfig } from "nats";
import { ServerConsumerOptions } from "./server-consumer-options.interface";
import { NatsConnectionOptions } from "./nats-connection-options.interface";

export interface NatsJetStreamServerOptions {
  connectionOptions: Partial<NatsConnectionOptions> &
    Pick<NatsConnectionOptions, "name">;
  consumerOptions: Partial<ServerConsumerOptions>;
  jetStreamOptions?: JetStreamOptions;
  streamConfig?: Partial<StreamConfig> &
    Pick<StreamConfig, "name" | "subjects">;
}
