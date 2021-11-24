import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy, ReadPacket, WritePacket } from "@nestjs/microservices";
import {
  Codec,
  connect,
  JetStreamClient,
  NatsConnection,
  PubAck,
  StringCodec,
} from "nats";
import { NATS_JETSTREAM_OPTIONS } from "./constants";
import { NatsJetStreamClientOptions } from "./interfaces";

@Injectable()
export class NatsJetStreamClientProxy extends ClientProxy {
  private nc: NatsConnection;
  private js: JetStreamClient;
  private sc: Codec<string>;

  constructor(
    @Inject(NATS_JETSTREAM_OPTIONS) private options: NatsJetStreamClientOptions
  ) {
    super();
    this.sc = StringCodec();
    // options.connectionOptions.waitOnFirstConnect = true;
    // this.connect();
  }

  async connect(): Promise<JetStreamClient> {
    this.nc = await connect(this.options.connectionOptions);
    this.js = this.nc.jetstream(this.options.jetStreamOption);
    return this.js;
  }
  close() {
    this.nc.close();
  }

  protected publish(
    packet: ReadPacket<any>,
    callback: (packet: WritePacket<any>) => void
  ): () => void {
    this.js
      .publish(
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
    return this.js.publish(
      packet.pattern,
      this.sc.encode(JSON.stringify(packet.data)),
      this.options.jetStreamPublishOptions
    );
  }
}
