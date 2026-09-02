# Deploying the Cloudflare Workers adapter

Prerequisites: a Cloudflare account, and `npm install` run in this directory.

1. **Authenticate wrangler** (once): `npx wrangler login`
2. **Create the KV namespace**: `npx wrangler kv namespace create SHARE_KV` — copy the returned `id` into `wrangler.toml`'s `[[kv_namespaces]]` block.
3. **Set the allowed origin** in `wrangler.toml`'s `[vars]` block — Selara's actual production origin (e.g. `https://app.selara.example`), not the placeholder.
4. **Deploy**: `npm run deploy` (runs `wrangler deploy` — Wrangler bundles `src/worker.ts` and its `core/` import directly, no separate build step).
5. Wrangler prints the deployed URL (`https://selara-share-backend.<your-subdomain>.workers.dev` by default, or a custom domain if configured). That URL is what `API_URL` in `src/lib/share.ts` should point at.

## Smoke test

```sh
curl -X POST https://<deployed-url> \
  -H 'Content-Type: application/json' \
  -d '{"ciphertext":"dGVzdA==","iv":"dGVzdA=="}'
# → {"id":"<32-hex-chars>"}

curl 'https://<deployed-url>?id=<id-from-above>'
# → {"ciphertext":"dGVzdA==","iv":"dGVzdA=="}
```
