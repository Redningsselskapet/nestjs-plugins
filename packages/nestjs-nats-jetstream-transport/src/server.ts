import {CustomTransportStrategy, Server} from "@nestjs/microservices";
import {
    Codec,
    connect,
    NatsConnection,
    SubscriptionOptions,
    JSONCodec,
} from "nats";

import {NatsContext, NatsJetStreamContext} from "./nats-jetstream.context";
import {serverConsumerOptionsBuilder} from "./utils/server-consumer-options-builder";
import {from} from "rxjs";
import {NatsJetStreamServerOptions} from "./interfaces/nats-jetstream-server-options.interface";

export class NatsJetStreamServer
    extends Server
    implements CustomTransportStrategy {
    private nc: NatsConnection;
    private codec: Codec<JSON>;

    constructor(private options: NatsJetStreamServerOptions) {
        super();
        this.codec = JSONCodec();
        this.logger.log('Init Nats JestStream Transport Version:')
    }

    async listen(callback: () => null) {
        if (!this.nc) {
            this.nc = await connect(this.options.connectionOptions);
        }

        await this.bindEventHandlers();
        this.bindMessageHandlers();
        callback();
    }

    async close() {
        await this.nc.drain();
        await this.nc.close();
    }

    private async bindEventHandlers() {
        const eventHandlers = [...this.messageHandlers.entries()].filter(
            ([, handler]) => handler.isEventHandler
        );

        const js = this.nc.jetstream(this.options.jetStreamOptions);

        for (const [subject, eventHandler] of eventHandlers) {
            const consumerOptions = serverConsumerOptionsBuilder(
                this.options.consumerOptions,
                subject
            );

            const subscription = await js.subscribe(subject, consumerOptions);
            this.logger.log(`Subscribed to ${subject} events`);
            const done = (async () => {
                for await (const msg of subscription) {
                    try {
                        const data = this.codec.decode(msg.data);
                        const context = new NatsJetStreamContext([msg]);
                        this.send(from(eventHandler(data, context)), () => null);
                    } catch (err) {
                        this.logger.error(err.message, err.stack);
                        // specifies that you failed to process the server and instructs
                        // the server to not send it again (to any consumer)
                        msg.term();
                    }
                }
            })();
            done.then(() => console.log('done'))
            setTimeout(() => subscription.unsubscribe(), 10000)
        }
    }

    private bindMessageHandlers() {
        const messageHandlers = [...this.messageHandlers.entries()].filter(
            ([, handler]) => !handler.isEventHandler
        );

        messageHandlers.forEach(async ([subject, messageHandler]) => {
            const subscriptionOptions: SubscriptionOptions = {
                queue: this.options.consumerOptions.deliverTo,
                callback: async (err, msg) => {
                    if (err) {
                        return this.logger.error(err.message, err.stack);
                    }
                    const payload = this.codec.decode(msg.data);
                    const context = new NatsContext([msg]);
                    const response$ = this.transformToObservable(
                        messageHandler(payload, context)
                    );
                    this.send(response$, (response) =>
                        msg.respond(this.codec.encode(response as JSON))
                    );
                },
            };

            this.nc.subscribe(subject, subscriptionOptions);
            this.logger.log(`Subscribed to ${subject} messages`);
        });
    }
}
