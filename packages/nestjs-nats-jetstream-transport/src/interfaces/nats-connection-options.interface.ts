import { Codec, ConnectionOptions, NatsConnection } from 'nats';

export interface NatsConnectionOptions extends ConnectionOptions {
  name: string;
  codec?: Codec<unknown>;
  connectedHook?: (nc: NatsConnection) => void;
}
