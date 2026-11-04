Bundle-time replacements for the optional dependencies of the libraries Fastnode bundles (see the
`resolve.alias` entries in `build.config.ts`).

Fastnode does not declare those packages as (peer) dependencies, so a bare `import("<id>")` inside a
bundled library cannot be resolved from Fastnode's own `dist/`. Each shim resolves the real package
from the user project instead, installing it on demand.

Each shim is aliased by its file name (`<id>.ts`). Its supported `version` range is listed under
`shims` in `deps.json` (synced by `pnpm sync-deps`) and must stay within the range the bundled
`library` accepts (checked by `test/unit/deps.test.ts`). These packages are not on demand
dependencies of Fastnode itself (the `deps` of the manifest).
