/**
 * What the server does with a JetStream message when its event handler fails.
 *
 * When this option is not set, the server behaves as in earlier versions: a
 * failed handler leaves the message unsettled. With `manualAck: true` it is
 * redelivered once `ackWait` expires (bounded by `maxDeliver`); without manual
 * ack the client acknowledges it automatically when the handler returns.
 */
export interface EventHandlerErrorOptions {
  /**
   * - `term`: tell JetStream never to redeliver the message.
   * - `nak`: ask JetStream to redeliver it, after `nakDelay` if given.
   */
  action: 'term' | 'nak';
  /**
   * Redelivery delay in milliseconds, only valid with `action: 'nak'`.
   * `0` or unset means redeliver immediately. Negative values are rejected.
   */
  nakDelay?: number;
}
