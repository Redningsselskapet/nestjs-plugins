import { ConnectionOptions, NatsConnection } from 'nats';

export interface NatsConnectionOptions extends ConnectionOptions {
  name: string;
  connectedHook?: (nc: NatsConnection) => void;
}
