import "#fastnode/virtual/polyfills";
import type { ServerRequest } from "srvx";
import { serve } from "srvx/deno";
import wsAdapter from "crossws/adapters/deno";

import { useFastnodeApp } from "fastnode/app";
import { startScheduleRunner } from "#fastnode/runtime/task";
import { trapUnhandledErrors } from "#fastnode/runtime/error/hooks";
import { resolveWebsocketHooks } from "#fastnode/runtime/app";
import { resolveServeOptions } from "#fastnode/runtime/serve";
import { setupCloseHooks } from "#fastnode/runtime/shutdown";

const fastnodeApp = useFastnodeApp();

let _fetch = fastnodeApp.fetch;

if (import.meta._websocket) {
  const { handleUpgrade } = wsAdapter({ resolve: resolveWebsocketHooks });
  _fetch = (req: ServerRequest) => {
    if (req.headers.get("upgrade") === "websocket") {
      return handleUpgrade(req, req.runtime!.deno!.info);
    }
    return fastnodeApp.fetch(req);
  };
}

const server = serve(resolveServeOptions({ fetch: _fetch }));

setupCloseHooks(server);

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner({ waitUntil: server.waitUntil });
}

export default {};
