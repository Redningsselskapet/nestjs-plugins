import { ModuleMetadata } from "@nestjs/common";
import {
  ConnectionOptions,
  JetStreamOptions,
  JetStreamPublishOptions,
} from "nats";

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

export interface NatsJetStreamServerOptions {
  id: string;
  connectionOptions: ConnectionOptions;
  consumerOptions: Partial<ServerConsumerOptions>;
  jetStreamOptions?: JetStreamOptions;
}

export interface ServerConsumerOptions {
  // https://nats.io/blog/jetstream-java-client-03-consume/
  durable?: boolean;
  deliverPolicy?:
    | "All"
    | "Last"
    | "New"
    | "ByStartSequence"
    | "ByStartTime"
    | "last_per_subject";
  startSequence?: number;
  startAtTimeDelta?: number;
  startTime?: Date;
  deliverTo?: string;
  deliverToSubject?: string;
  ackPolicy?: "Explicit" | "All" | "None";
  ackWait?: number;
  maxAckPending?: number;
  replayPolicy?:
    | "Instant"
    | "All"
    | "ByStartSequence"
    | "ByStartTime"
    | "Original";
  maxDeliver?: number;
  filterSubject?: string;
  sample?: number;
  idleHeartbeat?: number;
  flowControl?: boolean;
  maxWaiting?: number;
  maxMessages?: number;
  manualAck?: boolean;
  limit?: number;
  description?: string;
  orderedConsumer?: boolean;
  deliverGroup?: string;
  headersOnly?: boolean;
}
