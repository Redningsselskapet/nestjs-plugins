import { JetStreamOptions } from 'nats';
import { ServerConsumerOptions } from './server-consumer-options.interface';
import { NatsConnectionOptions } from './nats-connection-options.interface';
import { NatsStreamConfig } from './nats-stream-config.interface';

export interface NatsJetStreamServerOptions {
  connectionOptions: Partial<NatsConnectionOptions> &
    Pick<NatsConnectionOptions, 'name'>;
  consumerOptions: Partial<ServerConsumerOptions>;
  jetStreamOptions?: JetStreamOptions;
  streamConfig?: NatsStreamConfig;
}
