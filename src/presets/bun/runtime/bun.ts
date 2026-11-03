import "#fastnode/virtual/polyfills";
import type { ServerRequest } from "srvx";
import { serve } from "srvx/bun";
import wsAdapter from "crossws/adapters/bun";

import { useFastnodeApp } from "fastnode/app";
import { startScheduleRunner } from "#fastnode/runtime/task";
import { trapUnhandledErrors } from "#fastnode/runtime/error/hooks";
import { resolveWebsocketHooks } from "#fastnode/runtime/app";
import { resolveServeOptions } from "#fastnode/runtime/serve";
import { setupCloseHooks } from "#fastnode/runtime/shutdown";

const fastnodeApp = useFastnodeApp();

let _fetch = fastnodeApp.fetch;

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

if (import.meta._websocket) {
  _fetch = (req: ServerRequest) => {
    if (req.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(req, req.runtime!.bun!.server) as Promise<Response>;
    }
    return fastnodeApp.fetch(req);
  };
}

const server = serve(
  resolveServeOptions({
    fetch: _fetch,
    ...(import.meta._websocket ? { bun: { websocket: ws!.websocket } } : {}),
  })
);

setupCloseHooks(server);

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner({ waitUntil: server.waitUntil });
}

export default {};
