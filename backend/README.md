# Share backend

Backend for Selara's zero-knowledge Share Links feature ([issue #5](https://github.com/nofanto/Selara/issues/5)). Stores an already client-side-encrypted blob and hands it back by ID until it expires — the server never sees plaintext. See `src/lib/crypto.ts` and `src/lib/share.ts` for the frontend half.

Deployable to any of three cloud providers from the same core logic — see [`requirement-specs/share-backend-multi-cloud.md`](../requirement-specs/share-backend-multi-cloud.md) for the full design and [ADR-0011](../docs/adr/0011-share-backend-multi-cloud-plugin-architecture.md) for the decision record.

```
core/                — all business logic (validation, TTL, status codes, CORS), platform-agnostic, unit tested
adapters/gcp/         — Cloud Functions + Firestore
adapters/cloudflare/  — Workers + KV
adapters/aws/         — Lambda + DynamoDB
```

Each adapter directory has its own `package.json` and `DEPLOY.md` with the exact commands to stand it up. None of this is deployed yet — the Share feature stays disabled (`SHARING_ENABLED = false` in `src/components/DataControls.tsx`) until one adapter is actually deployed and `API_URL` in `src/lib/share.ts` points at it.

## Working on this

- Run `backend/core`'s tests from the repo root: `npm run test:backend`.
- `backend/` is intentionally excluded from the root `tsconfig.json`/`eslint.config.js` and is **not** part of the root npm workspace — install each package you're working on separately (`cd backend/core && ...` has no deps of its own; `cd backend/adapters/<provider> && npm install`).
