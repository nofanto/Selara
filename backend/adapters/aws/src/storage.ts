import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { GetResult, ShareRecord, StorageAdapter } from '../../../core/src/types';

/**
 * DynamoDB's TTL attribute deletion can lag up to 48h behind the actual
 * expiry (per AWS's own docs), so expiresAt is checked on every read — same
 * reasoning as the other two adapters. The TTL attribute is still configured
 * (see DEPLOY.md) purely as a storage-cost cleanup backstop.
 */
export class DynamoDbStorageAdapter implements StorageAdapter {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({})
  ) {
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async put(id: string, record: ShareRecord, ttlSeconds: number): Promise<void> {
    // DynamoDB's native TTL attribute must be epoch seconds, not milliseconds.
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { id, ciphertext: record.ciphertext, iv: record.iv, expiresAt },
      })
    );
  }

  async get(id: string): Promise<GetResult> {
    const { Item } = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { id } }));
    if (!Item) return { kind: 'not_found' };
    if (Item.expiresAt * 1000 < Date.now()) return { kind: 'expired' };
    return { kind: 'found', ciphertext: Item.ciphertext, iv: Item.iv };
  }
}
