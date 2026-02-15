export type GatewayHealth = {
  status: 'online' | 'offline' | 'degraded';
  uptime: string;
  activeSessions: number;
  runningJobs: number;
};

export type JobStatus = 'running' | 'queued' | 'failed' | 'done';

export type JobItem = {
  id: string;
  name: string;
  status: JobStatus;
  startedAt: string;
};

export type SessionItem = {
  id: string;
  name: string;
  state: 'active' | 'idle';
  model: string;
};

export type ChannelType = 'whatsapp' | 'telegram' | 'discord' | 'signal';

export type ChannelItem = {
  id: string;
  name: string;
  type: ChannelType;
  enabled: boolean;
};
