import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importSharedWorkspace } from './share';
import { decryptData } from './crypto';

vi.mock('./crypto', () => ({
  encryptData: vi.fn(),
  decryptData: vi.fn(),
}));

describe('importSharedWorkspace', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces a clear decryption failure message when the key is invalid', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ciphertext: 'ciphertext', iv: 'initialization-vector' }),
    });

    vi.mocked(decryptData).mockRejectedValue(new Error('bad decrypt'));

    await expect(importSharedWorkspace('share-id', 'bad-key')).rejects.toThrow(
      /Decryption Failed/i,
    );
  });
});
