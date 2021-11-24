import { BaseRpcContext } from "@nestjs/microservices/ctx-host/base-rpc.context";
import { JsMsg } from "nats";

export type NatsJetStreamContextArgs = [JsMsg];

export class NatsJetStreamContext extends BaseRpcContext<NatsJetStreamContextArgs> {
  constructor(args: NatsJetStreamContextArgs) {
    super(args);
  }

  get message(): JsMsg {
    return this.args[0];
  }
}
