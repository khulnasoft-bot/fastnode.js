import "#fastnode/virtual/polyfills";
import { toNodeHandler } from "srvx/node";
import wsAdapter from "crossws/adapters/node";

import { useFastnodeApp } from "fastnode/app";
import { startScheduleRunner } from "#fastnode/runtime/task";
import { resolveWebsocketHooks } from "#fastnode/runtime/app";

const fastnodeApp = useFastnodeApp();

export const middleware = toNodeHandler(fastnodeApp.fetch);

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

export const handleUpgrade = ws?.handleUpgrade;

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}
