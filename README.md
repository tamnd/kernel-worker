# kernel-worker

Vietnamese Linux kernel documentation snapshot, packaged as a Cloudflare
Worker project and served at
[`kernel.go-mizu.dev`](https://kernel.go-mizu.dev).

## Highlights

- Builds the kernel Sphinx docs from a sibling `kernel-docs-vi` checkout,
  overlaying Vietnamese translations (both `vi_VN/` and `vi_VN_mt/`) onto
  the upstream tree pinned in `kernel-docs-vi/UPSTREAM`.
- `dist/` is generated (not committed): it exceeds 150 MB after the full
  Sphinx build. Run `npm run build:static` before deploying; `npm run
  deploy` chains this automatically.
- Falls back to [`kernel.org/doc/html/latest`](https://www.kernel.org/doc/html/latest/)
  for any path that the snapshot does not cover, so the full kernel docs
  remain reachable at all times.

## Repository layout

```text
kernel-worker/
├── dist/                    # committed Sphinx output used by preview/deploy
├── scripts/build-static.mjs
├── scripts/preview-local.mjs
├── src/index.ts
├── wrangler.jsonc
└── package.json
```

## How it works

1. `scripts/build-static.mjs` reads the pinned SHA from
   `../kernel-docs-vi/UPSTREAM`, then performs a blobless, shallow,
   sparse partial clone of `torvalds/linux` limited to `Documentation/`,
   `tools/`, `scripts/`, and the license files.
2. Vietnamese translations from
   `../kernel-docs-vi/Documentation/translations/vi_VN/` are overlaid on
   the sparse checkout.
3. A local Python virtual environment is created and the kernel's own
   `Documentation/sphinx/requirements.txt` is installed into it.
4. `sphinx-build -b html` is run against `Documentation/` and the output
   is copied to `dist/`.
5. The Worker serves `dist/` as assets and rewrites any absolute
   `www.kernel.org/doc/html/latest/` URLs in HTML so that the site is
   self-consistent on its own domain.
6. Paths not present in `dist/` are proxied to
   `https://www.kernel.org/doc/html/latest/`.

## Requirements

- Node 22 recommended.
- `wrangler login` completed for the target Cloudflare account.
- The `go-mizu.dev` zone already active in Cloudflare.
- A sibling checkout of
  [`tamnd/kernel-docs-vi`](https://github.com/tamnd/kernel-docs-vi) at
  `../kernel-docs-vi`, or `DOCS_REPO=/path/to/kernel-docs-vi`.
- Python 3, `python3 -m venv` available, and enough disk space for the
  kernel sparse checkout (roughly 150 MB) plus the Sphinx build
  (another few hundred MB).

## Quick start

```bash
git clone https://github.com/tamnd/kernel-worker.git
cd kernel-worker
npm install
npm run preview
```

Local preview runs at:

```text
http://127.0.0.1:8787
```

## Commands

```bash
# regenerate dist/ from the sibling kernel-docs-vi repo
npm run build:static

# skip the Sphinx build and emit only a minimal landing page
SKIP_SPHINX=1 npm run build:static

# stable local preview of the committed dist/
npm run preview

# wrangler-based dev entrypoint
npm run dev:wrangler

# rebuild snapshot and deploy
npm run deploy
```

## Deployment

The worker config lives in `wrangler.jsonc` and is set up for:

- Worker name: `kernel-worker`
- Custom domain: `kernel.go-mizu.dev`
- Static asset binding from `./dist`

Deploy with:

```bash
npm run deploy
```

## Notes

- `dist/` is intentionally not committed: the kernel Sphinx build
  produces over 150 MB of output, which is impractical for a regular
  git repository. Rebuild with `npm run build:static` before serving
  locally or deploying.
- Local preview uses `scripts/preview-local.mjs` because it starts
  faster than `wrangler dev` and makes the proxy fallback easy to
  inspect.
- Rebuild the snapshot whenever `kernel-docs-vi` syncs upstream or lands
  new translations, then commit the updated `dist/`.
- The Vietnamese translation is maintained at
  [`tamnd/kernel-docs-vi`](https://github.com/tamnd/kernel-docs-vi). As
  translation progresses, more pages in `dist/` are served in Vietnamese
  automatically on the next build.

## License

Project-specific Worker glue in this repo is under MIT. Upstream
documentation content originates from the Linux kernel (GPL-2.0 by
default, per-file SPDX otherwise) and Vietnamese translations inherit
the license of their source files.
