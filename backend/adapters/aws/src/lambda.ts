import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { handleShareCore } from '../../../core/src/handleShare';
import type { GenericRequest } from '../../../core/src/types';
import { DynamoDbStorageAdapter } from './storage';

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MB
// Set via the Lambda's environment variables to Selara's actual production origin.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://CHANGE-ME.example';
const TABLE_NAME = process.env.TABLE_NAME ?? 'selara_shared_workspaces';

const storage = new DynamoDbStorageAdapter(TABLE_NAME);
const config = { allowedOrigin: ALLOWED_ORIGIN, ttlSeconds: TTL_SECONDS, maxPayloadBytes: MAX_PAYLOAD_BYTES };

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return null;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Written for a Lambda Function URL (payload format 2.0) — the simplest
// public HTTPS endpoint for a Lambda, no API Gateway needed. See DEPLOY.md.
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const genericReq: GenericRequest = {
    method: event.requestContext.http.method,
    origin: event.headers?.origin ?? event.headers?.Origin ?? null,
    query: event.queryStringParameters ?? {},
    body: parseBody(event),
  };

  const result = await handleShareCore(genericReq, storage, config);

  return {
    statusCode: result.status,
    headers: result.headers,
    body: result.body,
  };
};
