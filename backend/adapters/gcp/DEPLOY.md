# Deploying the GCP adapter

Prerequisites: a GCP project with billing enabled, the `gcloud` CLI authenticated (`gcloud auth login`), and `npm install` run in this directory.

1. **Set the active project**: `gcloud config set project <your-project-id>`
2. **Enable required APIs** (once per project): `gcloud services enable cloudfunctions.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com`
3. **Create a Firestore database** (Native mode, once per project): `gcloud firestore databases create --location=<region>` (e.g. `asia-southeast1`)
4. **Build**: `npm run build` — compiles TypeScript to `dist/` and writes `dist/package.json` (see the design doc for why this isn't esbuild-bundled).
5. **Deploy**:
   ```sh
   gcloud functions deploy handleShare \
     --gen2 \
     --runtime=nodejs20 \
     --region=<region> \
     --trigger-http \
     --allow-unauthenticated \
     --source=dist \
     --entry-point=handleShare \
     --set-env-vars=ALLOWED_ORIGIN=https://<selara-production-origin>
   ```
   (Or just `npm run deploy`, which runs the build first — edit the region/env var in `package.json`'s `deploy` script to match your setup.)
6. **(Recommended) Set a Firestore TTL policy** on the `shared_workspaces` collection's `expiresAt` field, via the console or `gcloud firestore fields ttls update expiresAt --collection-group=shared_workspaces --enable-ttl` — this is what actually deletes expired documents; the code's own `expiresAt` check just makes expiry *behave* correctly before that cleanup runs.
7. `gcloud functions deploy` prints the function's URL — that's what `API_URL` in `src/lib/share.ts` should point at.

## Smoke test

```sh
curl -X POST https://<deployed-url> \
  -H 'Content-Type: application/json' \
  -d '{"ciphertext":"dGVzdA==","iv":"dGVzdA=="}'
# → {"id":"<32-hex-chars>"}

curl 'https://<deployed-url>?id=<id-from-above>'
# → {"ciphertext":"dGVzdA==","iv":"dGVzdA=="}
```
