import { ModuleMetadata } from '@nestjs/common';
import { ConnectionOptions, JetStreamOptions } from 'nats';
import { NatsConnectionOptions } from './nats-connection-options.interface';

export interface NatsJetStreamClientOptions {
  connectionOptions: Partial<NatsConnectionOptions> &
    Pick<ConnectionOptions, 'name'>;
  /** @deprecated Use `jetStreamOptions`, which takes precedence when both are set. */
  jetStreamOption?: JetStreamOptions;
  jetStreamOptions?: JetStreamOptions;
}

// noinspection JSUnusedGlobalSymbols
export interface NatsJetStreamClientAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<NatsJetStreamClientOptions> | NatsJetStreamClientOptions;
  inject?: any[];
}
