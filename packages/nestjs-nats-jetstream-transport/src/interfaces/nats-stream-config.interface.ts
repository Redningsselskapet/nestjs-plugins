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
>;

export interface NatsStreamConfig extends Partial<$StreamConfig> {
  name: string;
  subjects: string[];
}
