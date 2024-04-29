import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import {
  Codec,
  connect,
  headers,
  JetStreamPublishOptions,
  JSONCodec,
  NatsConnection,
  RequestOptions,
} from 'nats';
import { NATS_JETSTREAM_OPTIONS } from './constants';
import { NatsJetStreamClientOptions } from './interfaces/nats-jetstream-client-options.interface';
import { NatsJetStreamRecord } from './utils/nats-jetstream-record.builder';
import { NatsRequestRecord } from './utils/nats-request-record-builder';

@Injectable()
export class NatsJetStreamClientProxy extends ClientProxy {
  private nc: NatsConnection;
  private codec: Codec<unknown>;

  constructor(
    @Inject(NATS_JETSTREAM_OPTIONS) private options: NatsJetStreamClientOptions,
  ) {
    super();

    // Use provided codec if exists, otherwise use JSONCodec as default
    if (options.connectionOptions.codec) {
      this.codec = options.connectionOptions.codec;
    } else {
      this.codec = JSONCodec();
    }
  }

  async connect(): Promise<NatsConnection> {
    if (!this.nc) {
      this.nc = await connect(this.options.connectionOptions);
      if (this.options.connectionOptions.connectedHook) {
        this.options.connectionOptions.connectedHook(this.nc);
      }
    }

    return this.nc;
  }

  async close() {
    await this.nc.drain();
    this.nc = undefined;
  }

  protected publish(
    packet: ReadPacket,
    callback: (packet: WritePacket) => void,
  ): () => void {
    const subject = this.normalizePattern(packet.pattern);

    if (packet.data instanceof NatsRequestRecord) {
      const options: RequestOptions = packet.data.options;
      const payload = this.codec.encode(packet.data.payload);
      this.nc
        .request(subject, payload, options)
        .then((msg) => this.codec.decode(msg.data) as WritePacket)
        .then((packet) => callback(packet))
        .catch((err) => {
          callback({ err });
        });
      return () => null;
    } else {
      const payload = this.codec.encode(packet.data);
      this.nc
        .request(subject, payload)
        .then((msg) => this.codec.decode(msg.data) as WritePacket)
        .then((packet) => callback(packet))
        .catch((err) => {
          callback({ err });
        });
      return () => null;
    }
  }

  protected async dispatchEvent(
    packet: ReadPacket<NatsJetStreamRecord>,
  ): Promise<any> {
    const subject = this.normalizePattern(packet.pattern);
    const jetStreamOpts = this.options.jetStreamOption;
    const js = this.nc.jetstream(jetStreamOpts);

    if (packet.data instanceof NatsJetStreamRecord) {
      const payload = this.codec.encode(packet.data.payload);
      const options = packet.data.options;
      return js.publish(subject, payload, options);
    } else {
      const payload = this.codec.encode(packet.data);
      return js.publish(subject, payload);
    }
  }
}
