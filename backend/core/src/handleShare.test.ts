import { describe, expect, it } from 'vitest';
import { handleShareCore } from './handleShare';
import type { GenericRequest, GetResult, HandleShareConfig, ShareRecord, StorageAdapter } from './types';

const config: HandleShareConfig = {
  allowedOrigin: 'https://selara.example',
  ttlSeconds: 60 * 60 * 24 * 7,
  maxPayloadBytes: 1024 * 1024,
};

class FakeStorageAdapter implements StorageAdapter {
  private store = new Map<string, { record: ShareRecord; expiresAt: number }>();
  puts: { id: string; record: ShareRecord; ttlSeconds: number }[] = [];

  seed(id: string, record: ShareRecord, expiresAt: number) {
    this.store.set(id, { record, expiresAt });
  }

  async put(id: string, record: ShareRecord, ttlSeconds: number): Promise<void> {
    this.puts.push({ id, record, ttlSeconds });
    this.store.set(id, { record, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async get(id: string): Promise<GetResult> {
    const entry = this.store.get(id);
    if (!entry) return { kind: 'not_found' };
    if (entry.expiresAt < Date.now()) return { kind: 'expired' };
    return { kind: 'found', ...entry.record };
  }
}

function makeRequest(overrides: Partial<GenericRequest> = {}): GenericRequest {
  return {
    method: 'GET',
    origin: 'https://selara.example',
    query: {},
    body: null,
    ...overrides,
  };
}

describe('handleShareCore — OPTIONS', () => {
  it('responds 204 to a preflight request with CORS headers', async () => {
    const storage = new FakeStorageAdapter();
    const res = await handleShareCore(makeRequest({ method: 'OPTIONS' }), storage, config);

    expect(res.status).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://selara.example');
  });
});

describe('handleShareCore — POST', () => {
  it('stores a valid payload and returns a generated id', async () => {
    const storage = new FakeStorageAdapter();
    const res = await handleShareCore(
      makeRequest({ method: 'POST', body: { ciphertext: 'abc', iv: 'def' } }),
      storage,
      config
    );

    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.id).toMatch(/^[0-9a-f]{32}$/);
    expect(storage.puts).toHaveLength(1);
    expect(storage.puts[0]).toMatchObject({
      id: parsed.id,
      record: { ciphertext: 'abc', iv: 'def' },
      ttlSeconds: config.ttlSeconds,
    });
  });

  it('rejects a payload missing ciphertext or iv with 400', async () => {
    const storage = new FakeStorageAdapter();
    const res = await handleShareCore(
      makeRequest({ method: 'POST', body: { ciphertext: 'abc' } }),
      storage,
      config
    );

    expect(res.status).toBe(400);
    expect(storage.puts).toHaveLength(0);
  });

  it('rejects a payload over the configured max size with 413', async () => {
    const storage = new FakeStorageAdapter();
    const res = await handleShareCore(
      makeRequest({ method: 'POST', body: { ciphertext: 'x'.repeat(10), iv: 'y' } }),
      storage,
      { ...config, maxPayloadBytes: 5 }
    );

    expect(res.status).toBe(413);
    expect(storage.puts).toHaveLength(0);
  });
});

describe('handleShareCore — GET', () => {
  it('returns the stored record for a valid, unexpired id', async () => {
    const storage = new FakeStorageAdapter();
    storage.seed('id-1', { ciphertext: 'abc', iv: 'def' }, Date.now() + 10_000);

    const res = await handleShareCore(makeRequest({ query: { id: 'id-1' } }), storage, config);

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ciphertext: 'abc', iv: 'def' });
  });

  it('returns 404 for an id that was never stored', async () => {
    const storage = new FakeStorageAdapter();
    const res = await handleShareCore(makeRequest({ query: { id: 'missing' } }), storage, config);

    expect(res.status).toBe(404);
  });

  it('returns 410 for an id that has expired', async () => {
    const storage = new FakeStorageAdapter();
    storage.seed('id-1', { ciphertext: 'abc', iv: 'def' }, Date.now() - 1000);

    const res = await handleShareCore(makeRequest({ query: { id: 'id-1' } }), storage, config);

    expect(res.status).toBe(410);
  });

  it('returns 400 when no id is given', async () => {
    const storage = new FakeStorageAdapter();
    const res = await handleShareCore(makeRequest({ query: {} }), storage, config);

    expect(res.status).toBe(400);
  });
});

describe('handleShareCore — method / CORS', () => {
  it('returns 405 for an unsupported method', async () => {
    const storage = new FakeStorageAdapter();
    const res = await handleShareCore(makeRequest({ method: 'DELETE' }), storage, config);

    expect(res.status).toBe(405);
  });

  it('does not echo back a disallowed origin in the CORS header', async () => {
    const storage = new FakeStorageAdapter();
    const res = await handleShareCore(
      makeRequest({ method: 'OPTIONS', origin: 'https://evil.example' }),
      storage,
      config
    );

    expect(res.headers['Access-Control-Allow-Origin']).not.toBe('https://evil.example');
  });

  it('allows a null origin (e.g. server-to-server or same-origin request)', async () => {
    const storage = new FakeStorageAdapter();
    const res = await handleShareCore(makeRequest({ method: 'OPTIONS', origin: null }), storage, config);

    expect(res.status).toBe(204);
  });
});
