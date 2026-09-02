export interface ShareRecord {
  ciphertext: string;
  iv: string;
}

export type GetResult =
  | ({ kind: 'found' } & ShareRecord)
  | { kind: 'expired' }
  | { kind: 'not_found' };

/**
 * The one thing each cloud provider's adapter must implement. Every provider
 * gets its own expiresAt bookkeeping and read-time check — native TTL
 * (Workers KV's expirationTtl, DynamoDB's TTL attribute) is a storage-cost
 * cleanup backstop, not the source of truth for 404 vs 410, since neither
 * platform deletes expired records instantly.
 */
export interface StorageAdapter {
  put(id: string, record: ShareRecord, ttlSeconds: number): Promise<void>;
  get(id: string): Promise<GetResult>;
}

export type GenericMethod = 'GET' | 'POST' | 'OPTIONS' | string;

export interface GenericRequest {
  method: GenericMethod;
  origin: string | null;
  query: Record<string, string | undefined>;
  body: unknown;
}

export interface GenericResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface HandleShareConfig {
  allowedOrigin: string;
  ttlSeconds: number;
  maxPayloadBytes: number;
}
