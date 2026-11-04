import type { H3Core, HTTPEvent } from "h3";
import type { HookableCore } from "../_hookable.ts";
import type { ServerRequest } from "srvx";

/**
 * The runtime Fastnode application instance accessible via `useFastnodeApp()`.
 *
 * @see https://fastnode.khulnasoft.com/docs/plugins
 */
export interface FastnodeApp {
  fetch: (req: Request) => Response | Promise<Response>;
  h3?: H3Core;
  hooks?: HookableCore<FastnodeRuntimeHooks>;
  captureError?: CaptureError;
  /**
   * Set while async plugins are still initializing and resolves once all
   * plugins have finished. `undefined` when the app is ready.
   *
   * Requests to `fetch` are held until then automatically.
   */
  ready?: Promise<void>;
}

/**
 * A Fastnode runtime plugin function.
 *
 * Receives the {@link FastnodeApp} instance (with `hooks` guaranteed to exist)
 * and can register runtime hooks or modify the app.
 *
 * A plugin can be async: the plugins after it run once it resolves, and
 * requests are held until all plugins have finished.
 *
 * @see https://fastnode.khulnasoft.com/docs/plugins
 */
export interface FastnodeAppPlugin {
  (
    fastnode: FastnodeApp & {
      hooks: NonNullable<FastnodeApp["hooks"]>;
    }
  ): void | Promise<void>;
}

export interface FastnodeAsyncContext {
  request: ServerRequest;
}

/** Context provided when an error is captured at runtime. */
export interface CapturedErrorContext {
  event?: HTTPEvent;
  tags?: string[];
}

/** Error capture callback used by `fastnodeApp.captureError`. */
export type CaptureError = (error: Error, context: CapturedErrorContext) => void;

/**
 * Runtime hooks available in Fastnode plugins.
 *
 * @see https://fastnode.khulnasoft.com/docs/plugins
 * @see https://fastnode.khulnasoft.com/docs/lifecycle
 */
export interface FastnodeRuntimeHooks {
  close: () => void;
  error: CaptureError;
  request: (event: HTTPEvent) => void | Promise<void>;
  response: (res: Response, event: HTTPEvent) => void | Promise<void>;
}
