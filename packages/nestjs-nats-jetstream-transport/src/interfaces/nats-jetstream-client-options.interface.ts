import { ModuleMetadata } from "@nestjs/common";
import { ConnectionOptions, JetStreamOptions, JetStreamPublishOptions } from "nats";

export interface NatsJetStreamClientOptions {
  connectionOptions: ConnectionOptions;
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