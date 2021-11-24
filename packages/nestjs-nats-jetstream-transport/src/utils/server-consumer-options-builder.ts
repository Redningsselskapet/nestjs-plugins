import { consumerOpts } from "nats";
import { ServerConsumerOptions } from "src/interfaces";

export function serverConsumerOptionsBuilder(
  serverConsumerOptions: ServerConsumerOptions
) {
  const {
    deliverGroup,
    deliverToSubject,
    deliverTo,
    manualAck,
    ackPolicy,
    deliverPolicy,
    description,
    // durable,
    filterSubject,
    flowControl,
    headersOnly,
    idleHeartbeat,
    limit,
    maxAckPending,
    maxDeliver,
    maxMessages,
    maxWaiting,
    orderedConsumer,
    replayPolicy,
    sample,
    startAtTimeDelta,
    startSequence,
    startTime,
  } = serverConsumerOptions;

  const opts = consumerOpts();

  deliverGroup && opts.deliverGroup(deliverGroup);
  manualAck && opts.manualAck();
  ackPolicy === "All" && opts.ackAll();
  ackPolicy === "Explicit" && opts.ackExplicit();
  ackPolicy === "None" && opts.ackNone();
  deliverPolicy === "All" && opts.deliverAll();
  deliverPolicy === "Last" && opts.deliverLast();
  deliverPolicy === "last_per_subject" && opts.deliverLastPerSubject();
  deliverPolicy === "New" && opts.deliverNew();
  deliverToSubject && opts.deliverTo(deliverToSubject);
  deliverTo && opts.deliverTo(deliverTo);

  description && opts.description(description);
  // durable && opts.durable('')
  filterSubject && opts.filterSubject(filterSubject);
  flowControl && opts.flowControl();
  headersOnly && opts.headersOnly();
  idleHeartbeat && opts.idleHeartbeat(idleHeartbeat);
  limit && opts.limit(limit);
  maxAckPending && opts.maxAckPending(maxAckPending);
  maxDeliver && opts.maxDeliver(maxDeliver);
  maxMessages && opts.maxMessages(maxMessages);
  maxWaiting && opts.maxWaiting(maxWaiting);
  orderedConsumer && opts.orderedConsumer();
  replayPolicy === "Instant" && opts.replayInstantly();
  replayPolicy === "Original" && opts.replayOriginal();
  sample && opts.sample(sample);
  startAtTimeDelta && opts.startAtTimeDelta(startAtTimeDelta);
  startSequence && opts.startSequence(startSequence);
  startTime && opts.startTime(startTime);

  return opts;
}
