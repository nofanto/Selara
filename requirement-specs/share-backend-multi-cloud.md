# Zero-Knowledge Share Backend: Multi-Cloud Plugin Architecture (Design Notes)

> **Status:** Implemented — the code is complete and green; **deployment is not done and remains the user's own step**. Resolves the "which cloud?" part of [issue #5](https://github.com/nofanto/Selara/issues/5) by not picking one — instead making the backend deployable to any of GCP, Cloudflare, or AWS from the same core logic. Deployment itself (actually standing up a project on one of these) is a separate, later step the user does themselves — see "Out of scope." Decision record: [ADR-0011](../docs/adr/0011-share-backend-multi-cloud-plugin-architecture.md). Walkthrough to actually turn the feature on: [`backend/SETUP.md`](../backend/SETUP.md). Coverage: `backend/core/src/handleShare.test.ts` (11 Vitest cases), run via `npm run test:backend`.

## Context and Problem Statement

The Share feature (`SHARING_ENABLED = false` in `src/components/DataControls.tsx`) is fully built on the frontend (`src/lib/crypto.ts`, `src/lib/share.ts`) but disabled because its backend (`backend/index.js`, pre-existing) points at Scenia's own GCP project — a Cloud Function + Firestore that Selara doesn't own or control.

While comparing GCP against Cloudflare Workers and AWS Lambda as deployment targets (see conversation), no single provider was clearly correct: all three land at effectively $0/month for this workload, and the "best" choice depends on infrastructure the user may or may not already have. Rather than commit to one and rewrite `backend/index.js` again later if that turns out wrong, the backend is restructured so the same request-handling logic runs unmodified on any of the three — a thin platform-specific adapter is the only thing that changes per provider.

## What the backend actually does

Distilled from the existing `backend/index.js`, independent of any platform:

- **POST**: validate `{ciphertext, iv}` are present and the payload is ≤ 1 MB, generate a high-entropy ID, store the record with a TTL (7 days), return `{id}`.
- **GET `?id=`**: look up the record; if it never existed, `404`; if it existed but has expired, `410`; otherwise return `{ciphertext, iv}`.
- **CORS**: only the app's own origin may call this; respond `204` to `OPTIONS` preflight.

None of this is GCP-specific. The only genuinely platform-specific concerns are: (a) how an HTTP request/response is shaped on that platform, and (b) how a small record gets stored with a TTL.

## Decided

### Architecture: ports-and-adapters (hexagonal)

```
backend/
  core/                     — platform-agnostic. Uses only Web-standard APIs
    src/types.ts              (StorageAdapter interface, generic Request/Response shapes)
    src/generateId.ts          (Web Crypto getRandomValues — works identically everywhere)
    src/handleShare.ts         (the business logic above, as one pure async function)
    src/handleShare.test.ts    (Vitest, against an in-memory fake StorageAdapter — no cloud SDK needed to test it)
  adapters/
    gcp/        src/storage.ts (FirestoreStorageAdapter)  src/index.ts (Cloud Functions entrypoint)
    cloudflare/ src/storage.ts (KvStorageAdapter)          src/worker.ts (Workers `fetch` entrypoint)
    aws/        src/storage.ts (DynamoDbStorageAdapter)    src/lambda.ts (Lambda handler entrypoint)
```

**The core `StorageAdapter` interface:**

```ts
interface StorageAdapter {
  put(id: string, record: { ciphertext: string; iv: string }, ttlSeconds: number): Promise<void>;
  get(id: string): Promise<
    | { kind: 'found'; ciphertext: string; iv: string }
    | { kind: 'expired' }
    | { kind: 'not_found' }
  >;
}
```

`handleShareCore(request, storage, config)` takes a generic `{method, origin, query, body}` request and a `StorageAdapter`, and returns a generic `{status, headers, body}` response — no platform types anywhere in its signature. Each adapter's entrypoint file does nothing but translate its platform's native request into the generic shape, call `handleShareCore`, and translate the generic response back.

**Why this shape specifically:**
- Every validation rule, status code decision, and the CORS/TTL policy lives in exactly one place (`core/`), tested once against a trivial in-memory fake — not duplicated three times or, worse, drifting between three re-implementations.
- Each adapter's entrypoint is small enough to read in one glance and hard to get wrong, because it does no business logic — just shape translation.
- `get()` always resolves the `404` vs `410` distinction itself, even on platforms with native TTL (Cloudflare KV, DynamoDB) — because native TTL expiry isn't instant on either platform (Cloudflare: up to ~60s propagation; DynamoDB: deletion can lag up to 48h per AWS's own docs), so relying on "the record is just gone" would make the two error cases indistinguishable and occasionally wrong. Each adapter stores its own `expiresAt` and checks it on read; native TTL (where available) is a storage-cost cleanup backstop, not the source of truth for the response code.
- `generateId()` and the payload-size check use only `crypto.getRandomValues` and `TextEncoder` — both Web-standard APIs available unmodified in Node 18+, Cloudflare Workers, and browsers — so they live in `core/` too, not duplicated per adapter.

### Language: TypeScript

The interface above is only worth having if it's compiler-checked — an adapter silently missing a method or returning the wrong shape should fail to build, not fail in production the first time someone opens an expired link. `backend/` gets its own `tsconfig.json`(s), separate from the root one (which is DOM/React-flavored and wrong for Node/Workers/Lambda runtimes) — see "Root project isolation" below.

### Per-adapter storage mapping

| Provider | Storage | TTL |
|---|---|---|
| GCP | Firestore (`shared_workspaces` collection) | Manual `expiresAt` check (existing behavior) + optional Firestore TTL policy for cleanup |
| Cloudflare | Workers KV | `expirationTtl` on `put()` for cleanup, **plus** a manual `expiresAt` field in the value for the 404/410 distinction |
| AWS | DynamoDB | Native `expiresAt` TTL attribute for cleanup, plus the same read-time check |

### Build & deploy per adapter

No adapter relies on a platform silently compiling TypeScript for you — each is built locally to plain JS first, then deployed as JS:

- **Cloudflare**: `wrangler deploy` — Wrangler's own bundler reads `src/worker.ts` directly; no separate build step. `wrangler.toml` declares the `SHARE_KV` binding.
- **AWS**: `esbuild`, bundling the adapter + `core/` into a single `dist/index.js` (CJS, Node target) — the AWS SDK v3 client is pure JS and bundles cleanly. Zipped and deployed via `aws lambda update-function-code`.
- **GCP**: plain `tsc` compiling to `dist/`, plus a generated `dist/package.json` listing just `@google-cloud/firestore`, deployed via `gcloud functions deploy --source=dist` — Cloud Build's own `npm install` step then installs Firestore's SDK. Deliberately *not* esbuild-bundled here: Firestore's client pulls in `@grpc/grpc-js`, which relies on dynamic `require()` calls for optional native bindings that don't bundle reliably into a single file. Letting Cloud Build install it normally sidesteps that risk entirely, and is GCP's own standard source-deploy workflow rather than fighting it.
- None of the three depend on a platform silently compiling TypeScript for you — GCP's `tsc` and AWS's `esbuild` both run locally before deploy, and only their *already-JS* dependency installation is left to the platform.

Each adapter has its own `package.json` (only the SDK it actually needs — Cloudflare's needs none at runtime, just `@cloudflare/workers-types` as a dev dependency) and its own `DEPLOY.md` with the exact commands.

### Root project isolation

Adding `.ts` files under `backend/` would otherwise get swept into the root `tsc --noEmit` (part of `npm run lint`) using the frontend's DOM/React-flavored `tsconfig.json`, and into the root `eslint.config.js`'s browser-globals ruleset — both wrong for Node/Workers/Lambda code, and `@cloudflare/workers-types`' global augmentations (`Request`, `Response`, `crypto`) actively conflict with the root config's `DOM` lib. So:

- Root `tsconfig.json` gets `"exclude": ["backend"]`.
- Root `eslint.config.js`'s existing `ignores` gains `'backend'`.
- `backend/` is **not** an npm workspace of the root `package.json` — it has its own dependency trees per adapter (GCP's Firestore SDK has no business being resolvable from the Vite frontend's `node_modules`, and vice versa). A root `npm run test:backend` script shells out to `backend/core`'s own `npm test`.

### Testing

`core/` gets Vitest unit tests (matching the rest of the project's testing tool) against an in-memory fake `StorageAdapter` — covering every status code path (200/400/404/410/413/204/405) without needing any real cloud service. This is `backend/core`'s own `npm test`, run via the root's `npm run test:backend` — not folded into the frontend's `npm run test:unit`, since backend code isn't part of the Vite app's module graph and pulling it in would mean the frontend's Vitest config resolving backend-only dependencies for no reason.

Adapters (`storage.ts`, entrypoints) are **not** unit tested against real cloud services — there's no live infrastructure to test against yet, and mocking each SDK deeply enough to be meaningful is low-value compared to keeping all real logic in the already-tested core. Each adapter's `DEPLOY.md` includes a manual smoke-test (curl a deployed endpoint) as the verification step once actually deployed.

## Considered and rejected

- **Pick one provider now, revisit later if wrong.** Rejected because the actual cost of building the abstraction properly once is small compared to a second full rewrite of `backend/index.js` later — and the "which provider" decision turned out to have no clearly-better answer at this traffic scale (see cost comparison, all ~$0/month), so there's no strong signal pointing at one over the others.
- **A runtime plugin system (load an adapter by config/env var from one deployed artifact).** Rejected — these three platforms don't share a runtime to begin with (you can't run "the same deployed function" on both Cloudflare Workers and AWS Lambda), so a runtime-pluggable design would be theater; the actual pluggability has to happen at build/deploy time, which is what the adapter folders already give you.
- **Full IaC (Terraform / Serverless Framework / SAM / CDK) per provider.** Rejected for now — three tiny endpoints don't need infrastructure-as-code; a `DEPLOY.md` with the exact CLI commands is simpler to read, audit, and run once, and doesn't add a new tool to learn for a feature this small. Worth reconsidering only if Selara ends up running many more backend services.
- **Fold backend into the root npm workspace.** Rejected — see "Root project isolation" above; the dependency trees genuinely don't belong together.

## Out of scope (this doc)

- **Actually deploying to any of the three.** This design makes all three *possible* from the same code; it doesn't pick one. Deployment requires a real cloud account, billing, and running the commands in each adapter's `DEPLOY.md` — the user's own action (no `gcloud`/`wrangler`/`aws` CLI is available in the assistant's sandbox).
- **Flipping `SHARING_ENABLED = true`.** Stays `false` until a real adapter is actually deployed and `src/lib/share.ts`'s `API_URL` points at it.
- **Rate limiting / abuse protection on the public write endpoint.** Flagged in issue #5's own notes as a security-review item; deferred, same as before this doc.
