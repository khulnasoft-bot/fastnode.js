import "./_runtime_warn.ts";
import type { FastnodeApp } from "fastnode/types";
import type { ServerRequest } from "srvx";
import { H3Core } from "h3";
import errorHandler from "#fastnode/virtual/error-handler";

export function createFastnodeApp(): FastnodeApp {
  const h3App = new H3Core({
    onError(error, event) {
      return errorHandler(error, event);
    },
  });
  const captureError: NonNullable<FastnodeApp["captureError"]> = (error, errorCtx) => {
    if (errorCtx?.event) {
      const errors = errorCtx.event.req.context?.fastnode?.errors;
      if (errors) {
        errors.push({ error, context: errorCtx });
      }
    }
  };
  return {
    fetch: (req: ServerRequest) => {
      req.context ||= {};
      req.context.fastnode = req.context.fastnode || { errors: [] };
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
