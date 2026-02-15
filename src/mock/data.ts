import { ChannelItem, GatewayHealth, JobItem, SessionItem } from '../types';

export const mockHealth: GatewayHealth = {
  status: 'online',
  uptime: '1d 4h',
  activeSessions: 4,
  runningJobs: 1,
};

export const mockJobs: JobItem[] = [
  { id: 'j1', name: 'Mission sync', status: 'running', startedAt: '2m ago' },
  { id: 'j2', name: 'Heartbeat checks', status: 'queued', startedAt: 'queued' },
  { id: 'j3', name: 'Daily digest', status: 'failed', startedAt: '8m ago' },
  { id: 'j4', name: 'Memory cleanup', status: 'done', startedAt: '24m ago' },
];

export const mockSessions: SessionItem[] = [
  { id: 's1', name: 'main', state: 'active', model: 'gpt-5.3-codex' },
  { id: 's2', name: 'watchdog', state: 'idle', model: 'gpt-5.3-codex' },
  { id: 's3', name: 'ops-worker', state: 'active', model: 'gpt-5.3-codex' },
];

export const mockChannels: ChannelItem[] = [
  { id: 'c1', name: 'Liam WhatsApp', type: 'whatsapp', enabled: true },
  { id: 'c2', name: 'Dev Discord', type: 'discord', enabled: true },
  { id: 'c3', name: 'Signal Backup', type: 'signal', enabled: false },
];
