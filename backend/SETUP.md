# Setting up infrastructure for the Share feature

This is the top-level walkthrough for turning on Selara's zero-knowledge Share Links feature ([issue #5](https://github.com/nofanto/Selara/issues/5)) — from "nothing deployed" to `SHARING_ENABLED = true`. For the architecture behind why there are three interchangeable backends, see [`requirement-specs/share-backend-multi-cloud.md`](../requirement-specs/share-backend-multi-cloud.md) and [ADR-0007](../docs/adr/0007-share-backend-multi-cloud-plugin-architecture.md) — this doc is the practical "how," not the "why."

## 1. Pick a provider

Any of the three works — same logic, same $0/month at this traffic level (small encrypted blobs, low volume). Pick whichever fits what you already have:

| Provider | Pick this if... | Setup effort |
|---|---|---|
| **Cloudflare Workers + KV** | You want the simplest path and don't already use GCP or AWS | Lowest — one CLI (`wrangler`), no separate storage service to provision |
| **GCP Cloud Functions + Firestore** | You already have a GCP project, or the deployed function should live alongside other GCP infrastructure | Medium — needs a GCP project with billing enabled |
| **AWS Lambda + DynamoDB** | You already run infrastructure on AWS | Medium — needs an IAM execution role and a Lambda Function URL |

You only need to deploy **one**. If you're unsure, Cloudflare has the fewest moving parts.

## 2. Deploy it

Follow the `DEPLOY.md` in that provider's adapter folder — each has the exact commands, in order, including the one-time account/project setup:

- [`backend/adapters/cloudflare/DEPLOY.md`](adapters/cloudflare/DEPLOY.md)
- [`backend/adapters/gcp/DEPLOY.md`](adapters/gcp/DEPLOY.md)
- [`backend/adapters/aws/DEPLOY.md`](adapters/aws/DEPLOY.md)

Each ends with a `curl` smoke test — run it before moving on. If the `POST` doesn't return an `{"id": "..."}` and the follow-up `GET` doesn't return your ciphertext back, something upstream is misconfigured (wrong CORS origin, missing IAM permission, table/collection not created) — fix that before touching any frontend code.

## 3. Point the frontend at it

Once you have a working deployed URL:

1. Open `src/lib/share.ts` and replace the hardcoded `API_URL` (currently Scenia's own endpoint) with your deployed URL.
2. Open `src/components/DataControls.tsx` and flip `SHARING_ENABLED` from `false` to `true` (around line 11).
3. Double check the `allowedOrigin`/`ALLOWED_ORIGIN` value you set during deploy (step 2) actually matches the origin Selara's frontend will be served from in production — a mismatch here fails silently as a CORS error in the browser console, not a clear error message.

## 4. Re-enable the disabled tests

Two Playwright suites are currently skipped specifically because the feature was off — they mock the network call, so they don't need your backend to actually be live, just for the feature flag to be on:

- `e2e/sharable-links.spec.ts` — remove `.skip` from `test.describe.skip('Sharable Links', ...)`
- `e2e/sharable-links-fail.spec.ts` — remove `.skip` from `test.describe.skip('Sharable Links - Failure Paths', ...)`

Run `npx playwright test e2e/sharable-links.spec.ts e2e/sharable-links-fail.spec.ts` to confirm both pass, then run the full suite (`npx playwright test`) to check for regressions, per the usual project workflow.

## 5. Verify end-to-end against the real backend

The Playwright suites above test the UI flow against a *mocked* network call — they don't prove the real deployed backend works with the real frontend. Do this manually once:

1. `npm run dev`, open the app, click **Share**, grant consent, generate a link.
2. Open the generated link in a different browser (or an incognito window) to simulate a different recipient.
3. Confirm the workspace loads correctly and matches what you shared.
4. Optional: wait out (or manually expire, if your provider makes that easy) the TTL and confirm the "expired or does not exist" error shows correctly on a stale link.

## Rollback

If anything looks wrong after enabling, flip `SHARING_ENABLED` back to `false` and re-add `.skip` to the two suites — the feature is fully gated behind that one flag, nothing else in the app depends on it being on.
