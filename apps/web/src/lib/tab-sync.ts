/**
 * Multi-Tab Synchronization via BroadcastChannel (with localStorage fallback)
 * Ensures consistent client flow step, queue position, and hold countdown across all open browser tabs.
 */

import { ClientContext } from './client-machine';

export type TabSyncMessage =
  | {
      type: 'TAB_STATE_BROADCAST';
      sourceTabId: string;
      state: Partial<ClientContext>;
      timestamp: number;
    }
  | {
      type: 'TAB_HEARTBEAT';
      sourceTabId: string;
      timestamp: number;
    }
  | {
      type: 'TAB_FORCE_RESYNC';
      sourceTabId: string;
    };

const CHANNEL_NAME = 'fairdrop_tab_sync_v1';
const TAB_ID = typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID().slice(0, 8)
  : `tab_${Math.random().toString(36).slice(2, 8)}`;

export class TabSyncManager {
  private channel: BroadcastChannel | null = null;
  private onMessageCallback?: (msg: TabSyncMessage) => void;
  private isListening = false;

  constructor(onMessage?: (msg: TabSyncMessage) => void) {
    this.onMessageCallback = onMessage;
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    if (typeof (window as any).BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<TabSyncMessage>) => {
        if (event.data?.sourceTabId === TAB_ID) return; // Ignore self
        this.onMessageCallback?.(event.data);
      };
      this.isListening = true;
    } else {
      // Fallback for older browsers: storage event
      (window as Window).addEventListener('storage', (e: StorageEvent) => {
        if (e.key === CHANNEL_NAME && e.newValue) {
          try {
            const data: TabSyncMessage = JSON.parse(e.newValue);
            if (data.sourceTabId === TAB_ID) return;
            this.onMessageCallback?.(data);
          } catch {
            // ignore
          }
        }
      });
      this.isListening = true;
    }
  }

  public broadcastState(state: Partial<ClientContext>): void {
    if (typeof window === 'undefined') return;

    const message: TabSyncMessage = {
      type: 'TAB_STATE_BROADCAST',
      sourceTabId: TAB_ID,
      state: {
        step: state.step,
        ticketId: state.ticketId,
        position: state.position,
        etaSec: state.etaSec,
        hold: state.hold,
        allocation: state.allocation,
        tier: state.tier,
        receiptId: state.receiptId,
        idempotencyKey: state.idempotencyKey,
      },
      timestamp: Date.now(),
    };

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn('BroadcastChannel send error', err);
      }
    } else if (window.localStorage) {
      try {
        window.localStorage.setItem(CHANNEL_NAME, JSON.stringify(message));
      } catch {
        // ignore quota
      }
    }
  }

  public getTabId(): string {
    return TAB_ID;
  }

  public destroy(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}
