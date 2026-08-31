import { describe, expect, it } from 'vitest';
import { SYNC_CHANNEL_NAME, generateTabId, isRemoteSaveMessage, notifyDataSaved } from './tabSync';

describe('generateTabId', () => {
  it('returns a different id on every call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateTabId()));
    expect(ids.size).toBe(50);
  });

  it('returns a non-empty string', () => {
    expect(typeof generateTabId()).toBe('string');
    expect(generateTabId().length).toBeGreaterThan(0);
  });
});

describe('isRemoteSaveMessage', () => {
  it('accepts a well-formed message from a different tab', () => {
    const msg = { type: 'data-saved', tabId: 'tab-other', savedAt: new Date().toISOString() };
    expect(isRemoteSaveMessage(msg, 'tab-mine')).toBe(true);
  });

  it('rejects a message whose tabId matches our own (self-echo)', () => {
    const msg = { type: 'data-saved', tabId: 'tab-mine', savedAt: new Date().toISOString() };
    expect(isRemoteSaveMessage(msg, 'tab-mine')).toBe(false);
  });

  it('rejects malformed payloads', () => {
    expect(isRemoteSaveMessage(null, 'tab-mine')).toBe(false);
    expect(isRemoteSaveMessage(undefined, 'tab-mine')).toBe(false);
    expect(isRemoteSaveMessage('a string', 'tab-mine')).toBe(false);
    expect(isRemoteSaveMessage({}, 'tab-mine')).toBe(false);
    expect(isRemoteSaveMessage({ type: 'something-else', tabId: 'tab-other', savedAt: 'x' }, 'tab-mine')).toBe(false);
    expect(isRemoteSaveMessage({ type: 'data-saved', tabId: 42, savedAt: 'x' }, 'tab-mine')).toBe(false);
    expect(isRemoteSaveMessage({ type: 'data-saved', tabId: 'tab-other' }, 'tab-mine')).toBe(false);
  });
});

describe('notifyDataSaved / cross-instance delivery', () => {
  it('delivers a message posted on one BroadcastChannel instance to another instance of the same name', async () => {
    const senderId = 'tab-sender';
    const receiverId = 'tab-receiver';
    const sender = new BroadcastChannel(SYNC_CHANNEL_NAME);
    const receiver = new BroadcastChannel(SYNC_CHANNEL_NAME);

    const received = new Promise<unknown>(resolve => {
      receiver.onmessage = (event) => resolve(event.data);
    });

    notifyDataSaved(sender, senderId);
    const data = await received;

    expect(isRemoteSaveMessage(data, receiverId)).toBe(true);
    // The receiver must be able to recognize its own tabId and ignore a message
    // carrying it, even though this particular delivery came from a different tab.
    expect(isRemoteSaveMessage(data, senderId)).toBe(false);

    sender.close();
    receiver.close();
  });
});
