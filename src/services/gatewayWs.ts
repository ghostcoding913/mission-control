type RpcRequest = {
  id: string;
  type: 'req';
  method: string;
  params?: Record<string, unknown>;
};

type RpcResponse = {
  id?: string;
  type?: string;
  ok?: boolean;
  payload?: unknown;
  error?: { message?: string; details?: { requestId?: string } } | string;
  event?: string;
};

export class GatewayWsClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private connected = false;
  private connectSent = false;

  constructor(private gatewayUrl: string, private token: string) {}

  private toWsUrl(input: string): string {
    const trimmed = input.trim();
    if (trimmed.startsWith('wss://') || trimmed.startsWith('ws://')) return trimmed;
    if (trimmed.startsWith('https://')) return trimmed.replace('https://', 'wss://');
    if (trimmed.startsWith('http://')) return trimmed.replace('http://', 'ws://');
    return `wss://${trimmed}`;
  }

  private connectParams() {
    return {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-android',
        version: 'dev',
        platform: 'android',
        mode: 'webchat',
      },
      role: 'operator',
      scopes: [
        'operator.read',
        'operator.write',
        'operator.pairing',
        'operator.approvals',
        'operator.admin',
      ],
      caps: [],
      auth: this.token ? { token: this.token } : undefined,
    };
  }

  private sendConnect() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.connectSent) return;
    this.connectSent = true;
    const id = `${Date.now()}-connect`;
    const payload: RpcRequest = {
      id,
      type: 'req',
      method: 'connect',
      params: this.connectParams(),
    };

    this.pending.set(id, {
      resolve: () => {
        this.connected = true;
      },
      reject: () => {
        this.connected = false;
      },
    });

    this.ws.send(JSON.stringify(payload));
  }

  async connect(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;

    const wsUrl = this.toWsUrl(this.gatewayUrl);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 15000);

      ws.onopen = () => {
        this.connectSent = false;
        this.sendConnect();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data ?? '{}')) as RpcResponse;

          if (data.type === 'event' && data.event === 'connect.challenge') {
            this.connectSent = false;
            this.sendConnect();
            return;
          }

          if (data.type === 'res' && data.id) {
            const p = this.pending.get(data.id);
            if (!p) return;
            this.pending.delete(data.id);

            if (data.ok === false) {
              const baseErr = typeof data.error === 'string' ? data.error : data.error?.message ?? 'Gateway request failed';
              const requestId = typeof data.error === 'string' ? undefined : data.error?.details?.requestId;
              const errMsg = requestId ? `${baseErr} (requestId: ${requestId})` : baseErr;
              p.reject(new Error(errMsg));
              if (String(data.id).includes('connect')) {
                clearTimeout(timeout);
                reject(new Error(errMsg));
              }
            } else {
              p.resolve(data.payload);
              if (String(data.id).includes('connect')) {
                clearTimeout(timeout);
                resolve();
              }
            }
          }
        } catch {
          // ignore malformed events
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket error'));
      };

      ws.onclose = () => {
        this.connected = false;
      };
    });
  }

  async request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || !this.connected) throw new Error('Gateway websocket not connected');

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload: RpcRequest = { id, type: 'req', method, params };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 12000);

      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timeout);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      ws.send(JSON.stringify(payload));
    });
  }

  close() {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    for (const [, p] of this.pending.entries()) p.reject(new Error('Client closed'));
    this.pending.clear();
  }
}
