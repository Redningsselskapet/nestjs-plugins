import { Inject, Injectable } from "@nestjs/common";
import {
  ClientProxy,
  ReadPacket,
  RpcException,
  WritePacket,
} from "@nestjs/microservices";
import { Codec, connect, JSONCodec, NatsConnection, NatsError, StringCodec } from "nats";
import { NATS_JETSTREAM_OPTIONS } from "./constants";
import { NatsJetStreamClientOptions } from "./interfaces/nats-jetstream-client-options.interface";

@Injectable()
export class NatsJetStreamClientProxy extends ClientProxy {
  private nc: NatsConnection;
  private codec: Codec<JSON>;

  constructor(
    @Inject(NATS_JETSTREAM_OPTIONS) private options: NatsJetStreamClientOptions
  ) {
    super();
    this.codec = JSONCodec();
  }

  async connect(): Promise<NatsConnection> {
    if (!this.nc) {
      this.nc = await connect(this.options.connectionOptions);
    }

    return this.nc;
  }

  async close() {
    await this.nc.drain();
    this.nc.close();
  }

  protected publish(
    packet: ReadPacket<any>,
    callback: (packet: WritePacket<any>) => void
  ): () => void {
    const payload = this.codec.encode(packet.data);
    const subject = this.normalizePattern(packet.pattern);

    this.nc
      .request(subject, payload)
      .then((msg) => this.codec.decode(msg.data) as WritePacket)
      .then((packet) => callback(packet))
      .catch((err) => {
        if (err.message ==='503') {
          err.message = `No responders subscribed to ${subject}`
          err.code = 503;
        }
        callback({ err });
      });
    return () => null;
  }

  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    const payload = this.codec.encode(packet.data);
    const subject = this.normalizePattern(packet.pattern);
    const jetstreamOpts = this.options.jetStreamOption;
    const jetstreamPublishOpts = this.options.jetStreamPublishOptions;

    const js = this.nc.jetstream(jetstreamOpts);
    return js.publish(subject, payload, jetstreamPublishOpts);
  }
}
