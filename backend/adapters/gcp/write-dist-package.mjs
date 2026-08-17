// Writes a minimal package.json into dist/ so `gcloud functions deploy --source=dist`
// can npm-install the (already-JS) runtime dependencies Cloud Build needs — see
// requirement-specs/share-backend-multi-cloud.md for why Firestore isn't esbuild-bundled.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

writeFileSync(
  new URL('./dist/package.json', import.meta.url),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      main: 'adapters/gcp/src/index.js',
      dependencies: pkg.dependencies,
    },
    null,
    2
  )
);
