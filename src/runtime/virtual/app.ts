import "./_runtime_warn.ts";
import type { FastnodeApp } from "fastnode/types";
import type { ServerRequest } from "srvx";
import { H3Core } from "h3";
import errorHandler from "#fastnode/virtual/error-handler";
import { captureFastnodeError, ensureFastnodeErrors } from "#fastnode/runtime/compatibility/h3";

export function createFastnodeApp(): FastnodeApp {
  const h3App = new H3Core({
    onError(error, event) {
      return errorHandler(error, event);
    },
  });
  const captureError: NonNullable<FastnodeApp["captureError"]> = (error, errorCtx) => {
    if (errorCtx?.event) {
      captureFastnodeError(errorCtx.event.req as ServerRequest, error, errorCtx);
    }
  };
  return {
    fetch: (req: ServerRequest) => {
      ensureFastnodeErrors(req);
      return h3App.fetch(req);
    },
    h3: h3App,
    hooks: undefined,
    captureError,
  };
}

export function initFastnodePlugins(app: FastnodeApp): FastnodeApp {
  return app;
}
