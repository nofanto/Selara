import { handleShareCore } from '../../../core/src/handleShare';
import type { GenericRequest } from '../../../core/src/types';
import { KvStorageAdapter } from './storage';

export interface Env {
  SHARE_KV: KVNamespace;
  // Set via `wrangler secret put ALLOWED_ORIGIN` or the [vars] table in wrangler.toml.
  ALLOWED_ORIGIN: string;
}

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MB

async function toGenericRequest(request: Request): Promise<GenericRequest> {
  const url = new URL(request.url);
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) query[key] = value;

  let body: unknown = null;
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }

  return {
    method: request.method,
    origin: request.headers.get('origin'),
    query,
    body,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const genericReq = await toGenericRequest(request);
    const storage = new KvStorageAdapter(env.SHARE_KV);
    const config = { allowedOrigin: env.ALLOWED_ORIGIN, ttlSeconds: TTL_SECONDS, maxPayloadBytes: MAX_PAYLOAD_BYTES };

    const res = await handleShareCore(genericReq, storage, config);
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
};
