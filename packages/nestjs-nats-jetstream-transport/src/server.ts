import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import {
  Codec,
  connect,
  JetStreamManager,
  JSONCodec,
  JsMsg,
  NatsConnection,
  StreamInfo,
  SubscriptionOptions,
} from 'nats';

import { connectable, isObservable, Subject } from 'rxjs';
import { NATS_JETSTREAM_TRANSPORT } from './constants';
import { EventHandlerErrorOptions } from './interfaces/event-handler-error-options.interface';
import { NatsJetStreamServerOptions } from './interfaces/nats-jetstream-server-options.interface';
import { NatsContext, NatsJetStreamContext } from './nats-jetstream.context';
import { serverConsumerOptionsBuilder } from './utils/server-consumer-options-builder';

export class NatsJetStreamServer
  extends Server
  implements CustomTransportStrategy
{
  readonly transportId: symbol = NATS_JETSTREAM_TRANSPORT;
  private nc: NatsConnection;
  private codec: Codec<JSON>;
  private jsm: JetStreamManager;

  constructor(private options: NatsJetStreamServerOptions) {
    super();
    this.codec = JSONCodec();
    validateEventHandlerErrorOptions(options.eventHandlerError);
  }

  async listen(callback: () => void) {
    if (!this.nc) {
      this.nc = await connect(this.options.connectionOptions);
      if (this.options.connectionOptions.connectedHook) {
        this.options.connectionOptions.connectedHook(this.nc);
      }
    }
    this.jsm = await this.nc.jetstreamManager(this.options.jetStreamOptions);
    if (this.options.streamConfig) {
      await this.setupStream();
    }

    await this.bindEventHandlers();
    this.bindMessageHandlers();
    callback();
  }

  async close() {
    if (!this.nc) {
      return;
    }
    await this.nc.drain();
    this.nc = undefined;
  }

  private async bindEventHandlers() {
    const eventHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => handler.isEventHandler,
    );

    const nc = this.nc;
    const js = nc.jetstream(this.options.jetStreamOptions);

    for (const [subject, eventHandler] of eventHandlers) {
      const consumerOptions = serverConsumerOptionsBuilder(
        this.options.consumerOptions,
        subject,
      );
      const subscription = await js.subscribe(subject, consumerOptions);
      this.logger.log(`Subscribed to ${subject} events`);
      const done = (async () => {
        for await (const msg of subscription) {
          let data: unknown;
          try {
            data = this.codec.decode(msg.data);
          } catch (err) {
            this.logger.error(err.message, err.stack);
            // A payload that cannot be decoded will never succeed, so tell
            // the server not to send it again (to any consumer).
            msg.term();
            continue;
          }
          try {
            const context = new NatsJetStreamContext([msg]);
            const resultOrStream = await eventHandler(data, context);
            if (isObservable(resultOrStream)) {
              const connectableSource = connectable(resultOrStream, {
                connector: () => new Subject(),
                resetOnDisconnect: false,
              });
              // Nest turns handler exceptions into an erroring Observable and
              // logs them, so this is where a failed handler surfaces.
              connectableSource.subscribe({
                error: () => this.onEventHandlerError(msg),
              });
              connectableSource.connect();
            }
          } catch (err) {
            this.logger.error(err.message, err.stack);
            if (this.options.eventHandlerError) {
              this.onEventHandlerError(msg);
            } else {
              msg.term();
            }
          }
        }
      })();
      done.then(() => {
        // if the connection is closed or draining, we don't need to unsubscribe as the subscription will be unsubscribed automatically
        if (nc.isDraining() || nc.isClosed()) {
          return;
        }
        subscription.destroy();

        this.logger.log(`Unsubscribed ${subject}`);
      });
    }
  }

  private bindMessageHandlers() {
    const messageHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => !handler.isEventHandler,
    );

    for (const [subject, messageHandler] of messageHandlers) {
      const subscriptionOptions: SubscriptionOptions = {
        queue: this.options.consumerOptions.deliverTo,
        callback: async (err, msg) => {
          if (err) {
            return this.logger.error(err.message, err.stack);
          }
          let payload: unknown;
          try {
            payload = this.codec.decode(msg.data);
          } catch (decodeErr) {
            this.logger.error(
              `Could not decode request on ${msg.subject}: ${decodeErr.message}`,
              decodeErr.stack,
            );
            // Answer with an error packet so the caller fails now instead of
            // waiting for its request timeout.
            msg.respond(
              this.codec.encode({
                err: { status: 'error', message: 'Invalid JSON payload' },
                isDisposed: true,
              } as unknown as JSON),
            );
            return;
          }
          const context = new NatsContext([msg]);
          const response$ = this.transformToObservable(
            messageHandler(payload, context),
          );
          this.send(response$, (response) =>
            msg.respond(this.codec.encode(response as JSON)),
          );
        },
      };

      this.nc.subscribe(subject, subscriptionOptions);
      this.logger.log(`Subscribed to ${subject} messages`);
    }
  }

  /**
   * Settle a message whose event handler failed, as configured by
   * `eventHandlerError`. Without that option the message is left alone, which
   * is how earlier versions behaved.
   */
  private onEventHandlerError(msg: JsMsg) {
    const handling = this.options.eventHandlerError;
    if (!handling) {
      return;
    }
    if (handling.action === 'term') {
      msg.term();
    } else {
      msg.nak(handling.nakDelay);
    }
  }

  private async setupStream() {
    const { streamConfig } = this.options;
    // Read every page; the first page alone misses streams on busy servers.
    const streams: StreamInfo[] = [];
    for await (const streamInfo of this.jsm.streams.list()) {
      streams.push(streamInfo);
    }

    const reqStreamConfigs = !Array.isArray(streamConfig)
      ? [streamConfig]
      : streamConfig;

    for (const requiredStreamConfig of reqStreamConfigs) {
      const stream = streams.find(
        (stream) => stream.config.name === requiredStreamConfig.name,
      );

      if (stream) {
        const streamSubjects = new Set([
          ...stream.config.subjects,
          ...requiredStreamConfig.subjects,
        ]);

        const streamInfo = await this.jsm.streams.update(stream.config.name, {
          ...stream.config,
          ...requiredStreamConfig,
          subjects: [...streamSubjects.keys()],
        });
        this.logger.log(`Stream ${streamInfo.config.name} updated`);
      } else {
        const streamInfo = await this.jsm.streams.add(requiredStreamConfig);
        this.logger.log(`Stream ${streamInfo.config.name} created`);
      }
    }
  }
}

function validateEventHandlerErrorOptions(options?: EventHandlerErrorOptions) {
  if (!options) {
    return;
  }
  if (options.action !== 'term' && options.action !== 'nak') {
    throw new Error(
      `eventHandlerError.action must be 'term' or 'nak', got ${JSON.stringify(
        options.action,
      )}`,
    );
  }
  if (options.nakDelay === undefined) {
    return;
  }
  if (options.action !== 'nak') {
    throw new Error(
      "eventHandlerError.nakDelay is only valid with action 'nak'",
    );
  }
  if (!Number.isFinite(options.nakDelay) || options.nakDelay < 0) {
    throw new Error(
      `eventHandlerError.nakDelay must be a number of milliseconds >= 0, got ${options.nakDelay}`,
    );
  }
}
