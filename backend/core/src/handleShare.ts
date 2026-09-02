import { generateId } from './generateId';
import type { GenericRequest, GenericResponse, HandleShareConfig, StorageAdapter } from './types';

function corsHeaders(origin: string | null, allowedOrigin: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (origin === allowedOrigin || !origin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

function json(status: number, headers: Record<string, string>, payload: unknown): GenericResponse {
  return { status, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
}

function text(status: number, headers: Record<string, string>, message: string): GenericResponse {
  return { status, headers, body: message };
}

/**
 * The entire Share backend's business logic, independent of which cloud
 * platform it's deployed to — see requirement-specs/share-backend-multi-cloud.md.
 * Every adapter's entrypoint does nothing but translate its platform's native
 * request/response into this generic shape and back.
 */
export async function handleShareCore(
  req: GenericRequest,
  storage: StorageAdapter,
  config: HandleShareConfig
): Promise<GenericResponse> {
  const headers = corsHeaders(req.origin, config.allowedOrigin);

  if (req.method === 'OPTIONS') {
    return { status: 204, headers, body: '' };
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { ciphertext?: unknown; iv?: unknown };
    const { ciphertext, iv } = body;

    if (typeof ciphertext !== 'string' || typeof iv !== 'string' || !ciphertext || !iv) {
      return text(400, headers, 'Missing ciphertext or iv');
    }

    if (new TextEncoder().encode(ciphertext).length > config.maxPayloadBytes) {
      return text(413, headers, `Payload too large (max ${config.maxPayloadBytes} bytes)`);
    }

    const id = generateId();
    await storage.put(id, { ciphertext, iv }, config.ttlSeconds);
    return json(200, headers, { id });
  }

  if (req.method === 'GET') {
    const id = req.query.id;
    if (!id) {
      return text(400, headers, 'Missing ID');
    }

    const result = await storage.get(id);
    if (result.kind === 'not_found') {
      return text(404, headers, 'Link expired or not found');
    }
    if (result.kind === 'expired') {
      return text(410, headers, 'This link has expired');
    }
    return json(200, headers, { ciphertext: result.ciphertext, iv: result.iv });
  }

  return text(405, headers, 'Method Not Allowed');
}
