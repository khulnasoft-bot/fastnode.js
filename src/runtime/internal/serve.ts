import type { ServerOptions } from "srvx";
import { serverEntryOptions } from "#fastnode/virtual/server-entry";
import { tracingSrvxPlugins } from "#fastnode/virtual/tracing";

/**
 * Resolve srvx `serve()` options for a server preset.
 *
 * Options exported from the server entry (`export default { fetch, ...options }`) are the base.
 * `FASTNODE_PORT`/`PORT`, `FASTNODE_HOST`/`HOST` and `FASTNODE_SSL_CERT`/`FASTNODE_SSL_KEY` take precedence
 * over them, and the preset's own options (`fetch` and runtime specific settings) win last.
 *
 * When `FASTNODE_UNIX_SOCKET` (or `node.path` in the server entry) is set, the server listens on
 * that UNIX socket (or Windows named pipe) instead of a TCP port.
 */
export function resolveServeOptions(opts: ServerOptions): ServerOptions {
  const { port, hostname, tls, ...entryOptions } = serverEntryOptions;

  const env: Record<string, string | undefined> = globalThis.process?.env || {};
  const _parsedPort = Number.parseInt(env.FASTNODE_PORT ?? env.PORT ?? "");
  const cert = env.FASTNODE_SSL_CERT;
  const key = env.FASTNODE_SSL_KEY;
  const socketPath = env.FASTNODE_UNIX_SOCKET;

  const resolved: ServerOptions = {
    ...entryOptions,
    port: Number.isNaN(_parsedPort) ? (port ?? 3000) : _parsedPort,
    hostname: env.FASTNODE_HOST || env.HOST || hostname,
    tls: cert && key ? { cert, key } : tls,
    ...opts,
    plugins: [...tracingSrvxPlugins, ...(opts.plugins || [])],
  };

  for (const runtime of ["node", "bun", "deno"] as const) {
    if (entryOptions[runtime] && opts[runtime]) {
      resolved[runtime] = { ...entryOptions[runtime], ...opts[runtime] } as any;
    }
  }

  if (socketPath) {
    resolved.node = { ...resolved.node, path: socketPath } as ServerOptions["node"];
    resolved.bun = { ...resolved.bun, unix: socketPath } as ServerOptions["bun"];
    resolved.deno = { ...resolved.deno, path: socketPath } as ServerOptions["deno"];
  }

  return resolved;
}
