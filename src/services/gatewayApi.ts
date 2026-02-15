import { mockChannels, mockHealth, mockJobs, mockSessions } from '../mock/data';
import { ChannelItem, GatewayHealth, JobItem, SessionItem } from '../types';

export type GatewayClientConfig = {
  baseUrl: string;
  token: string;
  useMock?: boolean;
};

const STATUS_PATHS = ['/status', '/api/status'];
const JOB_PATHS = ['/jobs', '/api/jobs'];
const SESSION_PATHS = ['/sessions', '/api/sessions'];
const CHANNEL_PATHS = ['/channels', '/api/channels'];

export class GatewayApi {
  private baseUrl: string;
  private token: string;
  private useMock: boolean;

  constructor(config: GatewayClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    this.useMock = config.useMock ?? true;
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.token ? `Bearer ${this.token}` : '',
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      throw new Error(`Gateway request failed (${res.status})`);
    }

    return (await res.json()) as T;
  }

  private async tryPaths<T>(paths: string[]): Promise<T> {
    let lastError: unknown;
    for (const path of paths) {
      try {
        return await this.call<T>(path);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Gateway request failed');
  }

  async testConnection(): Promise<boolean> {
    if (this.useMock) return true;
    await this.tryPaths(STATUS_PATHS);
    return true;
  }

  async getHealth(): Promise<GatewayHealth> {
    if (this.useMock) return mockHealth;
    return this.tryPaths<GatewayHealth>(STATUS_PATHS);
  }

  async getJobs(): Promise<JobItem[]> {
    if (this.useMock) return mockJobs;
    return this.tryPaths<JobItem[]>(JOB_PATHS);
  }

  async getSessions(): Promise<SessionItem[]> {
    if (this.useMock) return mockSessions;
    return this.tryPaths<SessionItem[]>(SESSION_PATHS);
  }

  async getChannels(): Promise<ChannelItem[]> {
    if (this.useMock) return mockChannels;
    return this.tryPaths<ChannelItem[]>(CHANNEL_PATHS);
  }
}
