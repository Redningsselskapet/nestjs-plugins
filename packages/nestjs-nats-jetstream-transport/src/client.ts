import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy, ReadPacket, WritePacket } from "@nestjs/microservices";
import { Codec, connect, JSONCodec, NatsConnection, StringCodec } from "nats";
import { NATS_JETSTREAM_OPTIONS } from "./constants";
import { NatsJetStreamClientOptions } from "./interfaces";

@Injectable()
export class NatsJetStreamClientProxy extends ClientProxy {
  private nc: NatsConnection;
  private jsonCodec: Codec<JSON>;

  constructor(
    @Inject(NATS_JETSTREAM_OPTIONS) private options: NatsJetStreamClientOptions
  ) {
    super();
    this.jsonCodec = JSONCodec();
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
    const payload = this.jsonCodec.encode(packet.data);
    const subject = this.normalizePattern(packet.pattern);

    this.nc
      .request(subject, payload)
      .then((msg) => this.jsonCodec.decode(msg.data) as WritePacket)
      .then((packet) => callback(packet))
      .catch((err) => callback({ err }));
    return () => null;
  }

  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    const payload = this.jsonCodec.encode(packet.data);
    const subject = this.normalizePattern(packet.pattern);
    const jetstreamOpts = this.options.jetStreamOption;
    const jetstreamPublishOpts = this.options.jetStreamPublishOptions;

    const js = this.nc.jetstream(jetstreamOpts);
    return js.publish(subject, payload, jetstreamPublishOpts);
  }
}
