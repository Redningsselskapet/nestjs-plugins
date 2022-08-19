import { BaseRpcContext } from '@nestjs/microservices/ctx-host/base-rpc.context';
import { JsMsg, Msg } from 'nats';

export type NatsJetStreamContextArgs = [JsMsg];
export type NatsContextArgs = [Msg];

export class NatsJetStreamContext extends BaseRpcContext<NatsJetStreamContextArgs> {
  constructor(args: NatsJetStreamContextArgs) {
    super(args);
  }

  get message(): JsMsg {
    return this.args[0];
  }
}

export class NatsContext extends BaseRpcContext<NatsContextArgs> {
  constructor(args: NatsContextArgs) {
    super(args);
  }

  get message(): Msg {
    return this.args[0];
  }
}
