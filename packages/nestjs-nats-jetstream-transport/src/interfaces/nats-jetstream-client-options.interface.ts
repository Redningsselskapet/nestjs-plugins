import { ModuleMetadata } from "@nestjs/common";
import { ConnectionOptions, JetStreamOptions, JetStreamPublishOptions } from "nats";

export interface NatsJetStreamClientOptions {
  connectionOptions: ConnectionOptions & Pick<ConnectionOptions, 'name'>;
  jetStreamOption?: JetStreamOptions;
  jetStreamPublishOptions?: JetStreamPublishOptions;
}

export interface NatsJetStreamClientAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  useFactory: (
    ...args: any[]
  ) => Promise<NatsJetStreamClientOptions> | NatsJetStreamClientOptions;
  inject?: any[];
}