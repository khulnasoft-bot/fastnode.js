import type { FastnodeApp, FastnodeRuntimeHooks } from "fastnode/types";
import type { ServerRequest } from "srvx";
import type { H3Core, H3Event, H3EventContext, WebSocketHooks } from "h3";
import { toRequest } from "h3";
import { HookableCore } from "hookable";

// IMPORTANT: virtual imports and user code should be imported last to avoid initialization order issues
import { createFastnodeApp, initFastnodePlugins } from "#fastnode/virtual/app";

declare global {
  /**
   * Global registry of runtime FastnodeApp instances, keyed by `APP_ID`
   * (`"default"` for normal runtime, `"prerender"` for prerender builds).
   *
   * This is a compatibility singleton: it lets `serverFetch()` (exported from
   * `fastnode.ts`) and presets locate the running app without an explicit
   * handle. Only one instance per `APP_ID` is expected in a given isolate;
   * concurrent Fastnode apps in the same global scope should use explicit
   * `createFastnodeApp()` handles instead.
   */
  var __fastnode__:
    | Partial<Record<"default" | "prerender" | (string & {}), FastnodeApp | undefined>>
    | undefined;
}

const APP_ID = import.meta.prerender ? "prerender" : "default";

export function useFastnodeApp(): FastnodeApp {
  // Return the cached instance from this module's closure first.
  let instance: FastnodeApp | undefined = (useFastnodeApp as any)._instance;
  if (instance) {
    return instance;
  }
  // Reuse an existing global instance for this APP_ID if one is already
  // registered, avoiding clobbering a concurrently running app.
  const existing = globalThis.__fastnode__?.[APP_ID];
  if (existing) {
    instance = (useFastnodeApp as any)._instance = existing;
    return instance;
  }
  instance = (useFastnodeApp as any)._instance = createFastnodeApp();
  globalThis.__fastnode__ = globalThis.__fastnode__ || {};
  globalThis.__fastnode__[APP_ID] = instance;
  initFastnodePlugins(instance);
  return instance;
}

export function useFastnodeHooks(): NonNullable<FastnodeApp["hooks"]> {
  const fastnodeApp = useFastnodeApp();
  const hooks = fastnodeApp.hooks;
  if (hooks) {
    return hooks;
  }
  return (fastnodeApp.hooks = new HookableCore<FastnodeRuntimeHooks>());
}

export function serverFetch(
  resource: string | URL | Request,
  init?: RequestInit,
  context?: H3EventContext
): Promise<Response> {
  const req = toRequest(resource, init);
  if (context) {
    req.context = { ...req.context, ...context };
  }
  const appHandler = useFastnodeApp().fetch;
  try {
    return Promise.resolve(appHandler(req));
  } catch (error) {
    return Promise.reject(error);
  }
}

// crossws' wire format for handing WebSocket hooks off on the *request*, written
// by h3's `defineWebSocketHandler()`. Read as a bare registry symbol rather than
// via `getWebSocketHooks()` so core runtime keeps no import of `crossws`.
const kWebSocketHooks: unique symbol = /* @__PURE__ */ Symbol.for("crossws.hooks");

export async function resolveWebsocketHooks(req: ServerRequest): Promise<Partial<WebSocketHooks>> {
  // The `crossws` property on the response is best-effort only: any staged
  // response header (a `headers` route rule, CORS, ...) makes h3 rebuild the
  // response, and a rebuild carries none of the original's own properties.
  const res = (await serverFetch(req)) as { crossws?: Partial<WebSocketHooks> };
  const carrier = req as unknown as Record<symbol, Partial<WebSocketHooks> | undefined> & {
    context?: Record<symbol, Partial<WebSocketHooks> | undefined>;
  };
  return res.crossws ?? carrier[kWebSocketHooks] ?? carrier.context?.[kWebSocketHooks] ?? {};
}

export function fetch(resource: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (typeof resource === "string" && resource.charCodeAt(0) === 47) {
    return serverFetch(resource, init);
  }
  resource = (resource as any)._request || resource; // unwrap srvx request
  return globalThis.fetch(resource, init);
}

// Re-export middleware factories so `#fastnode/runtime/app` (mapped to this
// file by the import map) keeps exporting them for build-time virtual modules.
export {
  getRouteRules,
  createRouteRulesMiddleware,
  createCacheRuleMiddleware,
  createRoutedMiddleware,
  createMethodNotAllowedMatcher,
} from "./middleware.ts";
