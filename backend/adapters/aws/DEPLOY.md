# Deploying the AWS adapter

Prerequisites: an AWS account, the `aws` CLI configured (`aws configure`), and `npm install` run in this directory.

1. **Create the DynamoDB table**:
   ```sh
   aws dynamodb create-table \
     --table-name selara_shared_workspaces \
     --attribute-definitions AttributeName=id,AttributeType=S \
     --key-schema AttributeName=id,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```
2. **Enable TTL** on the table's `expiresAt` attribute (storage-cost cleanup backstop — see the design doc for why this isn't what decides 404 vs 410):
   ```sh
   aws dynamodb update-time-to-live \
     --table-name selara_shared_workspaces \
     --time-to-live-specification "Enabled=true, AttributeName=expiresAt"
   ```
3. **Create an execution role** for the Lambda with `dynamodb:GetItem`/`dynamodb:PutItem` on that table, and basic Lambda logging permissions (`AWSLambdaBasicExecutionRole`).
4. **Package**: `npm run package` — bundles `src/lambda.ts` + `core/` into `dist/index.js` via esbuild, then zips it as `function.zip`.
5. **Create the function** (first time only):
   ```sh
   aws lambda create-function \
     --function-name selara-share-backend \
     --runtime nodejs20.x \
     --handler index.handler \
     --zip-file fileb://function.zip \
     --role <execution-role-arn> \
     --environment "Variables={ALLOWED_ORIGIN=https://<selara-production-origin>,TABLE_NAME=selara_shared_workspaces}"
   ```
6. **Expose a public URL**: `aws lambda create-function-url-config --function-name selara-share-backend --auth-type NONE` — prints the public HTTPS endpoint. That's what `API_URL` in `src/lib/share.ts` should point at.
7. **Subsequent deploys**: `npm run deploy` (re-packages and calls `aws lambda update-function-code`).

## Smoke test

```sh
curl -X POST https://<function-url> \
  -H 'Content-Type: application/json' \
  -d '{"ciphertext":"dGVzdA==","iv":"dGVzdA=="}'
# → {"id":"<32-hex-chars>"}

curl 'https://<function-url>?id=<id-from-above>'
# → {"ciphertext":"dGVzdA==","iv":"dGVzdA=="}
```
