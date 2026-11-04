// Config
import type { FastnodeConfig } from "fastnode/types";
import type { ServerRequestContext } from "srvx";
import { toRequest, type H3EventContext } from "h3";

export function defineConfig(
  config: Omit<FastnodeConfig, "rootDir">
): Omit<FastnodeConfig, "rootDir"> {
  return config;
}

// Type (only) helpers
export { definePlugin } from "./internal/plugin.ts";
export { defineRouteMeta } from "./internal/meta.ts";
export { defineErrorHandler } from "./internal/error/utils.ts";
export { defineServerEntry } from "./internal/server-entry.ts";

// H3
export {
  defineHandler,
  defineMiddleware,
  defineWebSocketHandler,
  html,
  HTTPError,
  HTTPResponse,
} from "h3";
export type { H3Event, EventHandlerRequest, EventHandlerWithFetch } from "h3";

// srvx
export type { FastResponse } from "srvx";

// Runtime
export function serverFetch(
  resource: string | URL | Request,
  init?: RequestInit,
  context?: ServerRequestContext | H3EventContext
): Promise<Response> {
  // Locate the running Fastnode app via the global singleton.
  // Resolution order:
  //   1. `__fastnode__.default`   — normal runtime app (set by `useFastnodeApp()`)
  //   2. `__fastnode__.prerender` — prerender runtime app
  //   3. `__fastnode_builder__`   — build-time `Fastnode` instance (set by
  //      `registerFastnodeInstance()` in `createFastnode()`)
  //
  // This fallback chain exists because `serverFetch()` is called from presets
  // and user code that may not have an explicit app handle. In single-tenant
  // serverless isolates this is unambiguous; in concurrent scenarios callers
  // should use an explicit `FastnodeApp.fetch()` instead.
  const fastnode =
    globalThis.__fastnode__?.default ||
    globalThis.__fastnode__?.prerender ||
    globalThis.__fastnode_builder__;
  if (!fastnode) {
    return Promise.reject(new Error("Fastnode instance is not available."));
  }
  const req = toRequest(resource, init);
  req.context = { ...req.context, ...context } as ServerRequestContext;
  try {
    return Promise.resolve(fastnode.fetch(req));
  } catch (error) {
    return Promise.reject(error);
  }
}

export function fetch(
  resource: string | URL | Request,
  init?: RequestInit,
  context?: ServerRequestContext | H3EventContext
): Promise<Response> {
  if (typeof resource === "string" && resource.charCodeAt(0) === 47) {
    return serverFetch(resource, init, context);
  }
  resource = (resource as any)._request || resource; // unwrap srvx request
  return globalThis.fetch(resource, init);
}
