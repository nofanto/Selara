import { build } from 'esbuild';

// AWS SDK v3 is pure JS and bundles cleanly, unlike Firestore's gRPC client —
// see requirement-specs/share-backend-multi-cloud.md for why GCP's adapter
// doesn't bundle the same way.
await build({
  entryPoints: ['src/lambda.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/index.js',
});
