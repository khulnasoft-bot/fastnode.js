import "#fastnode/virtual/polyfills";
import { NodeRequest, serve } from "srvx/node";
import wsAdapter from "crossws/adapters/node";

import { useFastnodeApp } from "fastnode/app";
import { startScheduleRunner } from "#fastnode/runtime/task";
import { trapUnhandledErrors } from "#fastnode/runtime/error/hooks";
import { resolveWebsocketHooks } from "#fastnode/runtime/app";
import { resolveServeOptions } from "#fastnode/runtime/serve";
import { setupCloseHooks } from "#fastnode/runtime/shutdown";

const fastnodeApp = useFastnodeApp();

const server = serve(resolveServeOptions({ fetch: fastnodeApp.fetch }));

// srvx only sets `process.exitCode` on listen errors; other handles (e.g. scheduled tasks) would keep the process alive.
server.ready().catch((error) => {
  console.error("[fastnode] Failed to start server:", error);
  process.exit(1);
});

if (import.meta._websocket) {
  const { handleUpgrade } = wsAdapter({ resolve: resolveWebsocketHooks });
  server.node!.server!.on("upgrade", (req, socket, head) => {
    handleUpgrade(
      req,
      socket,
      head,
      // @ts-expect-error (upgrade is not typed)
      new NodeRequest({ req, upgrade: { socket, head } })
    );
  });
}

setupCloseHooks(server);

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner({ waitUntil: server.waitUntil });
}

export default {};
