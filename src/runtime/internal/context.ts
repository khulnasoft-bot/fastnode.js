import type { FastnodeAsyncContext } from "fastnode/types";
import type { ServerRequest } from "srvx";

import { AsyncLocalStorage } from "node:async_hooks";
import { HTTPError } from "h3";
import { getContext, type UseContext } from "unctx";

export const fastnodeAsyncContext: UseContext<FastnodeAsyncContext> = /* @__PURE__ */ (() =>
  getContext<FastnodeAsyncContext>("fastnode-app", {
    asyncContext: import.meta._asyncContext,
    AsyncLocalStorage: import.meta._asyncContext ? AsyncLocalStorage : undefined,
  }))();

/**
 *
 * Access to the current Fastnode request.
 *
 * @experimental
 *  - Requires `experimental.asyncContext: true` config to work.
 *  - Works in Node.js and limited runtimes only
 *
 */
export function useRequest(): ServerRequest {
  try {
    return fastnodeAsyncContext.use().request;
  } catch {
    const hint = import.meta._asyncContext
      ? "Note: This is an experimental feature and might be broken on non-Node.js environments."
      : "Enable the experimental flag using `experimental.asyncContext: true`.";
    throw new HTTPError({
      message: `Fastnode request context is not available. ${hint}`,
    });
  }
}
