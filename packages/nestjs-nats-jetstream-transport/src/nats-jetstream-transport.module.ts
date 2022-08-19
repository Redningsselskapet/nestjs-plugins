import { DynamicModule } from '@nestjs/common';
import { NatsJetStreamClientProxy } from './client';
import { NATS_JETSTREAM_OPTIONS } from './constants';
import { NatsJetStreamClientOptions } from './interfaces/nats-jetstream-client-options.interface';
import { NatsJetStreamClient } from './nats-jetstream-client';

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
  static registerAsync(options: any): DynamicModule {
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
        NatsJetStreamClient,
      ],
      exports: [NatsJetStreamClientProxy, NatsJetStreamClient],
    };
  }
}
