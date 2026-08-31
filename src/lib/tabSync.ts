// Cross-tab sync — active/passive only, see requirement-specs/cross-tab-sync.md.
// One tab actively edits and saves; other tabs on the same workspace are passive
// viewers that reload from IndexedDB and refresh their in-memory state when they
// see another tab's save. No conflict resolution — this never applies to two tabs
// both actively editing at once (out of scope, see the design doc).

export const SYNC_CHANNEL_NAME = 'selara-sync';

export interface SyncMessage {
  type: 'data-saved';
  tabId: string;
  savedAt: string;
}

export function generateTabId(): string {
  return `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// A tab ignores a message carrying its own tabId, so a tab never reacts to its
// own save (whether via BroadcastChannel's own no-self-delivery guarantee, or a
// stray second channel instance from the same tab, e.g. across a hot-reload).
export function isRemoteSaveMessage(data: unknown, ownTabId: string): data is SyncMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.type === 'data-saved' &&
    typeof msg.tabId === 'string' &&
    msg.tabId !== ownTabId &&
    typeof msg.savedAt === 'string'
  );
}

export function notifyDataSaved(channel: BroadcastChannel, tabId: string): void {
  const message: SyncMessage = { type: 'data-saved', tabId, savedAt: new Date().toISOString() };
  channel.postMessage(message);
}
