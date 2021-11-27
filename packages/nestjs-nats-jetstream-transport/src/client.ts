import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy, ReadPacket, WritePacket } from "@nestjs/microservices";
import { Codec, connect, NatsConnection, StringCodec } from "nats";
import { NATS_JETSTREAM_OPTIONS } from "./constants";
import { NatsJetStreamClientOptions } from "./interfaces";

@Injectable()
export class NatsJetStreamClientProxy extends ClientProxy {
  private nc: NatsConnection;
  private sc: Codec<string>;

  constructor(
    @Inject(NATS_JETSTREAM_OPTIONS) private options: NatsJetStreamClientOptions
  ) {
    super();
    this.sc = StringCodec();
  }

  async connect(): Promise<NatsConnection> {
    if (!this.nc) {
      this.nc = await connect(this.options.connectionOptions);
    }

    return this.nc;
  }

  // TODO: Should this be drained?
  async close() {
    await this.nc.drain()
    this.nc.close();
  }

  protected publish(
    packet: ReadPacket<any>,
    callback: (packet: WritePacket<any>) => void
  ): () => void {
    const payload = this.sc.encode(JSON.stringify(packet.data));
    const subject = this.normalizePattern(packet.pattern);

    this.nc
      .request(subject, payload)
      .then((msg) => JSON.parse(this.sc.decode(msg.data)) as WritePacket)
      .then((packet) => callback(packet))
      .catch((err) => callback({ err }));
    return () => null;
  }

  protected async dispatchEvent<T = any>(packet: ReadPacket<T>): Promise<any> {
    const payload = this.sc.encode(JSON.stringify(packet.data));
    const subject = packet.pattern;
    const jetstreamOpts = this.options.jetStreamOption;
    const jetstreamPublishOpts = this.options.jetStreamPublishOptions;

    const js = this.nc.jetstream(jetstreamOpts);
    return js.publish(subject, payload, jetstreamPublishOpts);
  }
}
