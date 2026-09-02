import { Firestore } from '@google-cloud/firestore';
import type { HttpFunction } from '@google-cloud/functions-framework';
import { handleShareCore } from '../../../core/src/handleShare';
import type { GenericRequest } from '../../../core/src/types';
import { FirestoreStorageAdapter } from './storage';

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MB
// Set via the deployed function's environment variables (`gcloud functions deploy
// --set-env-vars ALLOWED_ORIGIN=...`) to Selara's actual production origin.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://CHANGE-ME.example';

const firestore = new Firestore();
const storage = new FirestoreStorageAdapter(firestore);
const config = { allowedOrigin: ALLOWED_ORIGIN, ttlSeconds: TTL_SECONDS, maxPayloadBytes: MAX_PAYLOAD_BYTES };

export const handleShare: HttpFunction = async (req, res) => {
  const genericReq: GenericRequest = {
    method: req.method ?? 'GET',
    origin: req.get('origin') ?? null,
    query: req.query as Record<string, string | undefined>,
    body: req.body,
  };

  const result = await handleShareCore(genericReq, storage, config);

  res.set(result.headers);
  res.status(result.status).send(result.body);
};
