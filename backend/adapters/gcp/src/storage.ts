import { Firestore, Timestamp } from '@google-cloud/firestore';
import type { GetResult, ShareRecord, StorageAdapter } from '../../../core/src/types';

const COLLECTION = 'shared_workspaces';

interface StoredDoc {
  ciphertext: string;
  iv: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

/**
 * Firestore has no reliable native TTL enforcement (its TTL policy is a
 * best-effort background job, not instant), so expiresAt is checked on every
 * read — same as the inherited backend/index.js this replaces. An optional
 * Firestore TTL policy on `expiresAt` can be added purely for storage-cost
 * cleanup; it isn't what decides 404 vs 410.
 */
export class FirestoreStorageAdapter implements StorageAdapter {
  constructor(private readonly firestore: Firestore) {}

  async put(id: string, record: ShareRecord, ttlSeconds: number): Promise<void> {
    const doc: StoredDoc = {
      ciphertext: record.ciphertext,
      iv: record.iv,
      expiresAt: Timestamp.fromMillis(Date.now() + ttlSeconds * 1000),
      createdAt: Timestamp.now(),
    };
    await this.firestore.collection(COLLECTION).doc(id).set(doc);
  }

  async get(id: string): Promise<GetResult> {
    const snapshot = await this.firestore.collection(COLLECTION).doc(id).get();
    if (!snapshot.exists) return { kind: 'not_found' };

    const data = snapshot.data() as StoredDoc;
    if (data.expiresAt.toMillis() < Date.now()) return { kind: 'expired' };
    return { kind: 'found', ciphertext: data.ciphertext, iv: data.iv };
  }
}
