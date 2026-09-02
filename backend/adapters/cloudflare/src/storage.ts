import type { GetResult, ShareRecord, StorageAdapter } from '../../../core/src/types';

interface StoredValue extends ShareRecord {
  expiresAt: number;
}

/**
 * Workers KV's own expirationTtl is a storage-cost cleanup backstop (min 60s,
 * not instant) — the expiresAt field stored in the value is what actually
 * decides 404 vs 410. See requirement-specs/share-backend-multi-cloud.md.
 */
export class KvStorageAdapter implements StorageAdapter {
  constructor(private readonly kv: KVNamespace) {}

  async put(id: string, record: ShareRecord, ttlSeconds: number): Promise<void> {
    const value: StoredValue = { ...record, expiresAt: Date.now() + ttlSeconds * 1000 };
    await this.kv.put(id, JSON.stringify(value), { expirationTtl: ttlSeconds });
  }

  async get(id: string): Promise<GetResult> {
    const raw = await this.kv.get(id);
    if (!raw) return { kind: 'not_found' };

    const { ciphertext, iv, expiresAt } = JSON.parse(raw) as StoredValue;
    if (expiresAt < Date.now()) return { kind: 'expired' };
    return { kind: 'found', ciphertext, iv };
  }
}
