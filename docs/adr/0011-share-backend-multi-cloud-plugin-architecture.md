# ADR-0011: Multi-cloud plugin architecture for the Share backend

## Status

Accepted

## Context and Problem Statement

The zero-knowledge Share feature (issue #5) is fully built on the frontend but disabled (`SHARING_ENABLED = false`) because its backend (`backend/index.js`) points at Scenia's own GCP project. Selara needs its own backend before this can be enabled. Comparing GCP, Cloudflare Workers, and AWS Lambda as the deployment target found no clearly-better option — all three land at effectively $0/month for this workload (small encrypted blobs, TTL-based auto-expiry, low traffic), and the right choice depends on infrastructure the user may or may not already have elsewhere.

## Decision Drivers

- Avoid committing to one provider now and having to redo this work if it turns out to be the wrong one.
- The actual business logic (validate payload, generate ID, enforce TTL, decide status codes, CORS) is provider-independent and should exist exactly once, not duplicated per provider.
- The logic should be unit-testable without needing live cloud infrastructure — there's no deployed backend to test against yet.
- Minimize new tooling: no IaC framework, no runtime plugin loader — just enough structure to keep the shared logic shared and the platform-specific parts small and mechanical.

## Considered Options

- Pick one provider (e.g. GCP, since `backend/index.js` already targets it) and rewrite for that alone.
- A ports-and-adapters architecture: one platform-agnostic core plus a thin adapter per provider (GCP, Cloudflare, AWS), all implementing the same `StorageAdapter` interface.

## Decision Outcome

Chosen option: ports-and-adapters, in TypeScript. See `requirement-specs/share-backend-multi-cloud.md` for the full design (the `StorageAdapter` interface, the generic request/response shape, per-provider storage mapping, build/deploy approach, and why root project isolation is needed). Summary:

- `backend/core/` holds the entire business logic as one pure, platform-agnostic function (`handleShareCore`), tested with Vitest against an in-memory fake adapter.
- `backend/adapters/{gcp,cloudflare,aws}/` each hold a `storage.ts` (implements `StorageAdapter` against Firestore / Workers KV / DynamoDB) and a thin entrypoint that only translates that platform's native request/response shape to/from the generic one used by `core/`.
- TypeScript, so the `StorageAdapter` interface is compiler-enforced, not just a convention an adapter could silently drift from.
- `backend/` is excluded from the root `tsconfig.json`/`eslint.config.js` and is not part of the root npm workspace — its dependency trees (Firestore SDK, AWS SDK) don't belong in the frontend's module graph, and the root tsconfig's `DOM` lib actively conflicts with `@cloudflare/workers-types`' global augmentations.

### Pros and Cons of the Options

#### Pick one provider now

- Good, because it's less code to write today.
- Bad, because the provider comparison found no clear winner — this would be a coin flip codified into an irreversible rewrite of the one existing implementation, with a real chance of having to redo it.

#### Ports-and-adapters, multi-provider

- Good, because the actual regulatory-adjacent logic (payload validation, TTL, 404-vs-410 correctness) is written and tested exactly once, regardless of how many providers end up supported.
- Good, because deploying to a second provider later (or switching) is adding a small adapter folder, not another rewrite.
- Bad, because it's more upfront structure (3 adapter folders, a shared core, isolated tsconfig) than a single-file Cloud Function — not worth it for a feature that will only ever run on one provider, but this one's target provider is explicitly undecided.

## Consequences

- New `backend/` internal structure: `core/` (shared logic + tests) and `adapters/{gcp,cloudflare,aws}/` (storage adapter + entrypoint + `DEPLOY.md` each), replacing the old flat `backend/index.js`.
- Root `tsconfig.json` gains `"exclude": ["backend"]`; root `eslint.config.js`'s `ignores` gains `'backend'`.
- Root `package.json` gains a `test:backend` script that runs `backend/core`'s own Vitest suite; this is a second, separate "full suite" gate alongside the existing `npm run test:unit` / `npx playwright test` for frontend work.
- No adapter is actually deployed by this change — `SHARING_ENABLED` stays `false` until the user deploys one and points `src/lib/share.ts`'s `API_URL` at it.
