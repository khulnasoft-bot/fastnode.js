import type { Server } from "srvx";
import { useFastnodeHooks } from "./app.ts";

/**
 * Call the Fastnode `close` hooks when the server shuts down.
 *
 * srvx handles graceful shutdown on `SIGINT` and `SIGTERM` by calling `server.close()`,
 * with no knowledge of Fastnode hooks. Wrapping `close` covers both the signal path and
 * explicit `server.close()` calls, and keeps hooks awaited as part of the shutdown.
 *
 * Hooks run once (a forced close after the graceful timeout awaits the same call) and
 * also run if the underlying close fails.
 */
export function setupCloseHooks(server: Server): void {
  const closeServer = server.close.bind(server);
  let closeHooks: Promise<void> | undefined;
  server.close = (closeActiveConnections?: boolean) =>
    closeServer(closeActiveConnections).finally(() => (closeHooks ??= callCloseHooks()));
}

async function callCloseHooks(): Promise<void> {
  try {
    await useFastnodeHooks().callHook("close");
  } catch (error) {
    console.error("[fastnode] Error while calling `close` hooks:", error);
  }
}
