import { JetStreamOptions } from 'nats';
import { EventHandlerErrorOptions } from './event-handler-error-options.interface';
import { ServerConsumerOptions } from './server-consumer-options.interface';
import { NatsConnectionOptions } from './nats-connection-options.interface';
import { NatsStreamConfig } from './nats-stream-config.interface';

export interface NatsJetStreamServerOptions {
  connectionOptions: Partial<NatsConnectionOptions> &
    Pick<NatsConnectionOptions, 'name'>;
  consumerOptions: Partial<ServerConsumerOptions>;
  jetStreamOptions?: JetStreamOptions;
  streamConfig?: NatsStreamConfig | NatsStreamConfig[];
  /** What to do with a message when its event handler fails. See README. */
  eventHandlerError?: EventHandlerErrorOptions;
}
