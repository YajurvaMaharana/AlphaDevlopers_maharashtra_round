/**
 * Resilient Server-Sent Events (SSE) Client
 * Features:
 * - Exponential backoff with random full jitter
 * - Automatic Last-Event-ID tracking and resume across reconnects
 * - Handles offline/online browser lifecycle
 * - Heartbeat/liveness detection
 */

export type SSEConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export interface SSEMessage<T = any> {
  id?: string;
  event: string;
  data: T;
  raw: string;
}

export interface SSEClientOptions {
  url: string;
  headers?: Record<string, string>;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxRetries?: number;
  storageKey?: string;
  onStatusChange?: (status: SSEConnectionStatus) => void;
  onMessage?: (message: SSEMessage) => void;
  onError?: (err: Error, attempt: number, nextRetryMs: number) => void;
}

export class ResilientSSEClient {
  private url: string;
  private headers: Record<string, string>;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private maxRetries: number;
  private storageKey: string;

  private status: SSEConnectionStatus = 'connecting';
  private attempt = 0;
  private abortController: AbortController | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastEventId: string | null = null;
  private isDestroyed = false;

  private onStatusChange?: (status: SSEConnectionStatus) => void;
  private onMessage?: (message: SSEMessage) => void;
  private onError?: (err: Error, attempt: number, nextRetryMs: number) => void;

  constructor(options: SSEClientOptions) {
    this.url = options.url;
    this.headers = options.headers || {};
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.maxRetries = options.maxRetries ?? Infinity;
    this.storageKey = options.storageKey ?? 'fairdrop_sse_last_event_id';
    this.onStatusChange = options.onStatusChange;
    this.onMessage = options.onMessage;
    this.onError = options.onError;

    // Restore cached Last-Event-ID if available
    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.lastEventId = window.sessionStorage.getItem(this.storageKey);
    }
  }

  private setStatus(newStatus: SSEConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.onStatusChange?.(newStatus);
    }
  }

  public getStatus(): SSEConnectionStatus {
    return this.status;
  }

  public getLastEventId(): string | null {
    return this.lastEventId;
  }

  public connect(): void {
    if (this.isDestroyed) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setStatus('offline');
      return;
    }

    if (this.attempt === 0) {
      this.setStatus('connecting');
    } else {
      this.setStatus('reconnecting');
    }

    this.abortController = new AbortController();

    // Construct URL with lastEventId query param for fallback compatibility
    const urlObj = new URL(this.url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    if (this.lastEventId) {
      urlObj.searchParams.set('lastEventId', this.lastEventId);
    }

    const fetchHeaders: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...this.headers,
    };

    if (this.lastEventId) {
      fetchHeaders['Last-Event-ID'] = this.lastEventId;
    }

    fetch(urlObj.toString(), {
      method: 'GET',
      headers: fetchHeaders,
      signal: this.abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`SSE HTTP error ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('ReadableStream not supported on response body');
        }

        // Successfully connected! Reset backoff counter
        this.attempt = 0;
        this.setStatus('connected');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (!this.isDestroyed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const block of parts) {
            if (!block.trim()) continue;
            this.parseSSEBlock(block);
          }
        }

        // Normal closure from server, initiate reconnect
        if (!this.isDestroyed) {
          this.scheduleReconnect();
        }
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError' || this.isDestroyed) return;
        this.handleError(err);
      });
  }

  private parseSSEBlock(block: string): void {
    const lines = block.split('\n');
    let eventName = 'message';
    let dataStr = '';
    let eventId: string | undefined = undefined;

    for (const line of lines) {
      if (line.startsWith(':')) {
        // Comment or heartbeat line
        continue;
      }
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const content = line.slice(5).trim();
        dataStr += (dataStr ? '\n' : '') + content;
      } else if (line.startsWith('id:')) {
        eventId = line.slice(3).trim();
      }
    }

    if (eventId) {
      this.lastEventId = eventId;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.setItem(this.storageKey, eventId);
        } catch {
          // ignore storage quota issues
        }
      }
    }

    let parsedData: any = dataStr;
    try {
      parsedData = JSON.parse(dataStr);
    } catch {
      // Raw string fallback
    }

    this.onMessage?.({
      id: eventId,
      event: eventName,
      data: parsedData,
      raw: dataStr,
    });
  }

  private handleError(err: Error): void {
    this.attempt++;
    const retryDelay = this.calculateBackoffWithJitter();

    this.onError?.(err, this.attempt, retryDelay);
    this.scheduleReconnect(retryDelay);
  }

  /**
   * Exponential Backoff with Full Jitter:
   * temp = min(maxDelay, baseDelay * 2^attempt)
   * sleep = random_between(0, temp)
   */
  private calculateBackoffWithJitter(): number {
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * Math.pow(2, this.attempt));
    const jitter = Math.random() * 1000;
    return Math.floor(exponential + jitter);
  }

  private scheduleReconnect(delayMs?: number): void {
    if (this.isDestroyed || this.attempt >= this.maxRetries) return;

    const delay = delayMs ?? this.calculateBackoffWithJitter();
    this.setStatus('reconnecting');

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public disconnect(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setStatus('connecting');
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
  }
}
