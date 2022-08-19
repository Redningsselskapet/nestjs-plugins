import { ModuleMetadata } from '@nestjs/common';
import {
  ConnectionOptions,
  JetStreamOptions,
  JetStreamPublishOptions,
} from 'nats';
import { NatsConnectionOptions } from './nats-connection-options.interface';

export interface NatsJetStreamClientOptions {
  connectionOptions: Partial<NatsConnectionOptions> &
    Pick<ConnectionOptions, 'name'>;
  jetStreamOption?: JetStreamOptions;
  jetStreamPublishOptions?: JetStreamPublishOptions;
}

// noinspection JSUnusedGlobalSymbols
export interface NatsJetStreamClientAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<NatsJetStreamClientOptions> | NatsJetStreamClientOptions;
  inject?: any[];
}
