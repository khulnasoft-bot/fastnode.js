import type { HTTPError, HTTPMethod, HTTPEvent, HTTPHandler } from "h3";
import type { PresetName } from "../presets/index.ts";
import type { OperationObject, OpenAPI3, Extensable } from "../types/openapi-ts.ts";

type MaybeArray<T> = T | T[];

/**
 * Route-level metadata attached to event handlers.
 *
 * @experimental
 * @see https://fastnode.khulnasoft.com/docs/routing
 */
export interface FastnodeRouteMeta {
  openAPI?: OperationObject & {
    $global?: Pick<OpenAPI3, "components"> & Extensable;
  };
}

interface FastnodeHandlerCommon {
  /**
   * HTTP pathname pattern to match.
   *
   * @example "/test", "/api/:id", "/blog/**"
   */
  route: string;

  /**
   * HTTP method to match.
   */
  method?: HTTPMethod;

  /**
   * Run handler as a middleware before other route handlers.
   */
  middleware?: boolean;

  /**
   * Route metadata (e.g. OpenAPI operation info).
   */
  meta?: FastnodeRouteMeta;
}

/**
 * Handler module format.
 *
 * - `"web"` — standard Web API handler (default).
 * - `"node"` — Node.js-style handler, automatically converted to web-compatible.
 */
export type EventHandlerFormat = "web" | "node";

/**
 * Event handler registration for build-time bundling.
 *
 * Handlers are file references that the bundler imports and transforms.
 * For runtime-only handlers in development, use {@link FastnodeDevEventHandler}.
 *
 * @see https://fastnode.khulnasoft.com/config/routing#handlers
 * @see https://fastnode.khulnasoft.com/docs/routing
 */
export interface FastnodeEventHandler extends FastnodeHandlerCommon {
  /**
   * Use lazy loading to import handler.
   */
  lazy?: boolean;

  /**
   * Path to event handler.
   */
  handler: string;

  /**
   * Event handler type.
   *
   * Default is `"web"`. If set to `"node"`, the handler will be converted into a web compatible handler.
   */
  format?: EventHandlerFormat;

  /**
   * Environments to include and bundle this handler.
   *
   * @example
   * ```ts
   * env: ["dev", "prod"]
   * env: "prerender"
   * ```
   */
  env?: MaybeArray<"dev" | "prod" | "prerender" | PresetName | (string & {})>;
}

/**
 * Development-only event handler with an inline handler function.
 *
 * These handlers are available only during `fastnode dev` and are not
 * included in production builds.
 *
 * @see https://fastnode.khulnasoft.com/config/routing#devhandlers
 */
export interface FastnodeDevEventHandler extends FastnodeHandlerCommon {
  /**
   * Event handler function.
   */
  handler: HTTPHandler;
}

type MaybePromise<T> = T | Promise<T>;

/**
 * Custom error handler function signature.
 *
 * Receives the error, the H3 event, and a helper object containing the
 * `defaultHandler` for fallback rendering.
 *
 * @see https://fastnode.khulnasoft.com/config/routing#errorhandler
 */
export type FastnodeErrorHandler = (
  error: HTTPError,
  event: HTTPEvent,
  _: {
    defaultHandler: (
      error: HTTPError,
      event: HTTPEvent,
      opts?: { silent?: boolean; json?: boolean }
    ) => MaybePromise<{
      status?: number;
      statusText?: string;
      headers?: HeadersInit;
      body?: string | Record<string, any>;
    }>;
  }
) => MaybePromise<Response | void>;
