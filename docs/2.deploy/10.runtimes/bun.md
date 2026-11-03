---
icon: simple-icons:bun
---

# Bun

> Run Fastnode apps with Bun runtime.

**Preset:** `bun`

Fastnode output is compatible with the Bun runtime. While the default [Node.js](/deploy/runtimes/node) output also runs in Bun, building with the `bun` preset enables Bun-specific optimizations.

After building with the `bun` preset, start the production server with:

```bash
bun run ./.output/server/index.mjs
```

## Environment Variables

You can customize server behavior with the following environment variables:

- `FASTNODE_PORT` or `PORT` (defaults to `3000`)
- `FASTNODE_HOST` or `HOST`
- `FASTNODE_UNIX_SOCKET` - When set to a socket file path, the server listens on it instead of a TCP port, ignoring `FASTNODE_PORT`/`PORT` and `FASTNODE_HOST`/`HOST`.
- `FASTNODE_SSL_CERT` and `FASTNODE_SSL_KEY` - When both are set, the server launches in HTTPS mode. This is intended for testing only; in production, run the Fastnode server behind a reverse proxy that terminates SSL.

```bash
FASTNODE_UNIX_SOCKET=./app.sock bun run ./.output/server/index.mjs
```

You can also set Bun-specific listener options in the [server entry](/docs/server-entry), for example to listen on a UNIX socket:

```ts [server.ts]
export default {
  bun: { unix: "./app.sock" },
  fetch() {},
};
```

:read-more{to="https://bun.sh"}
