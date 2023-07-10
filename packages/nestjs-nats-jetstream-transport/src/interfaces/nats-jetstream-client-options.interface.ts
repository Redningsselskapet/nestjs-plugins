import { ModuleMetadata } from '@nestjs/common';
import { ConnectionOptions, JetStreamOptions } from 'nats';
import { NatsConnectionOptions } from './nats-connection-options.interface';

export interface NatsJetStreamClientOptions {
  connectionOptions: Partial<NatsConnectionOptions> &
    Pick<ConnectionOptions, 'name'>;
  jetStreamOption?: JetStreamOptions;
}

// noinspection JSUnusedGlobalSymbols
export interface NatsJetStreamClientAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<NatsJetStreamClientOptions> | NatsJetStreamClientOptions;
  inject?: any[];
}
