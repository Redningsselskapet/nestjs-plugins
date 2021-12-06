import { ConnectionOptions } from "nats";

export interface NatsConnectionOptions extends ConnectionOptions {
  name: string;
}
