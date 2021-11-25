import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy, ReadPacket, WritePacket } from "@nestjs/microservices";
import {
  Codec,
  connect,
  NatsConnection,
  PubAck,
  StringCodec,
} from "nats";
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

  close() {
    this.nc.close();
  }

  // TODO: This should be reque-replay nats
  protected publish(
    packet: ReadPacket<any>,
    callback: (packet: WritePacket<any>) => void
  ): () => void {
    const js = this.nc.jetstream(this.options.jetStreamOption);
    js.publish(
      packet.pattern,
      this.sc.encode(JSON.stringify(packet.data)),
      this.options.jetStreamPublishOptions
    )
      .then((pubAck: PubAck) => {
        callback({ response: pubAck });
      })
      .catch((err) => callback(err));
    return () => {};
  }

  protected async dispatchEvent<T = any>(packet: ReadPacket<T>): Promise<any> {
    const js = this.nc.jetstream(this.options.jetStreamOption);
    return js.publish(
      packet.pattern,
      this.sc.encode(JSON.stringify(packet.data)),
      this.options.jetStreamPublishOptions
    );
  }
}
