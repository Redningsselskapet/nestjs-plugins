import { StreamConfig } from 'nats';

type $StreamConfig = Pick<
  StreamConfig,
  | 'storage'
  | 'retention'
  | 'discard'
  | 'max_msgs'
  | 'max_msgs_per_subject'
  | 'max_msg_size'
  | 'max_age'
  | 'duplicate_window'
  | 'num_replicas'
  | 'max_bytes'
  | 'name'
  | 'subjects'
  | 'max_consumers'
  | 'placement'
  | 'mirror'
  | 'sources'
  | 'description'
  | 'sealed'
  | 'deny_delete'
  | 'deny_purge'
  | 'allow_rollup_hdrs'
  | 'allow_direct'
  | 'discard_new_per_subject'
  | 'metadata'
  | 'mirror_direct'
  | 'no_ack'
  | 'republish'
  | 'subject_transform'
  | 'compression'
  | 'consumer_limits'
  | 'first_seq'
>;

export interface NatsStreamConfig extends Partial<$StreamConfig> {
  name: string;
  subjects: string[];
}
