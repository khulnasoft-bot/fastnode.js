import type { H3Core, H3Event, HTTPEvent, MatchedRoute, Middleware } from "h3";
import type { ServerRequest, ServerRequestContext } from "srvx";

// H3 compatibility boundary.
//
// H3 exposes several internal members prefixed with `~` (e.g. `~findRoute`,
// `~middleware`, `~dispatch`, `~composed`). They are stable within the h3 v2
// minor line but are implementation details, not public contracts.
//
// All Fastnode access to these members is centralized here so that an h3
// upgrade only needs to be audited in one place.

/** Resolve the matched route for an event via h3's `~findRoute`. */
export function h3FindRoute(h3: H3Core, event: H3Event): MatchedRoute | undefined {
  const result = h3["~findRoute"](event);
  return (result as MatchedRoute | undefined) ?? undefined;
}

/** Push middleware onto h3's `~middleware` chain. */
export function h3PushMiddleware(h3: H3Core, middleware: Middleware[]) {
  h3["~middleware"].push(...middleware);
}

/** Reset h3's composed dispatcher so plugins can re-compose the chain. */
export function h3ResetDispatcher(h3: H3Core) {
  h3["~dispatch"] = h3["~composed"] = undefined;
}

/** Get h3's `~middleware` chain. */
export function h3GetMiddleware(h3: H3Core): Middleware[] {
  return h3["~middleware"];
}

/** Ensure `req.context.fastnode.errors` exists and return it. */
export function ensureFastnodeErrors(
  req: ServerRequest
): { error: unknown; context: { event?: HTTPEvent } }[] {
  req.context ||= {};
  const ctx = req.context as {
    fastnode?: { errors?: { error: unknown; context: { event?: HTTPEvent } }[] };
  };
  ctx.fastnode = ctx.fastnode || { errors: [] };
  return ctx.fastnode.errors!;
}

/** Push a captured error into `req.context.fastnode.errors`. */
export function captureFastnodeError(
  req: ServerRequest,
  error: unknown,
  errorCtx: { event?: HTTPEvent }
) {
  ensureFastnodeErrors(req).push({ error, context: errorCtx });
}
