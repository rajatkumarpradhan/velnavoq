# Production deployment preservation

The 14 October 2026 release is already live as version d766f08c-6fc7-44e9-9402-3d1cadb67cbb. This configuration correction does not deploy a new version.

For a future authorized release, use the preserved `wrangler.production.json` with the compiled Worker at `dist/index.js` and complete UI assets at `ui-dist/`:

```sh
wrangler deploy --config wrangler.production.json --keep-vars
```

Keep `workers_dev: true`, `preview_urls: false`, and `keep_vars: true`. The explicit Preview URLs value prevents Wrangler from enabling extra per-version hostnames again. It is unrelated to the separate `velnavoq-isolated-preview` Worker; leave that Worker unchanged.

Preserve the existing D1 database, AI and service bindings, origins, variables, compatibility settings and secret values. No migrations, resource creation, deletion or secret rotation is part of this correction. Build and inspect future assets before a separately authorized deployment; do not deploy the repository's local `wrangler.jsonc` as production configuration.
