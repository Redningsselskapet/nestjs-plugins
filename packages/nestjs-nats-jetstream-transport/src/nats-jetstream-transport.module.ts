import { DynamicModule } from '@nestjs/common';
import { NatsJetStreamClientProxy } from './client';
import { NATS_JETSTREAM_OPTIONS } from './constants';
import {
  NatsJetStreamClientAsyncOptions,
  NatsJetStreamClientOptions,
} from './interfaces/nats-jetstream-client-options.interface';

// noinspection JSUnusedGlobalSymbols
export class NatsJetStreamTransport {
  static register(options: NatsJetStreamClientOptions): DynamicModule {
    const providers = [
      {
        provide: NATS_JETSTREAM_OPTIONS,
        useValue: options,
      },
      NatsJetStreamClientProxy,
    ];

    return {
      providers,
      exports: providers,
      module: NatsJetStreamTransport,
    };
  }
  static registerAsync(
    options: NatsJetStreamClientAsyncOptions,
  ): DynamicModule {
    return {
      module: NatsJetStreamTransport,
      imports: options.imports,
      providers: [
        {
          provide: NATS_JETSTREAM_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        NatsJetStreamClientProxy,
      ],
      exports: [NatsJetStreamClientProxy],
    };
  }
}
