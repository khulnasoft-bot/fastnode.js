import "#fastnode/virtual/polyfills";

import { useFastnodeApp, useFastnodeHooks } from "fastnode/app";
import { resolveWebsocketHooks } from "#fastnode/runtime/app";
import { startScheduleRunner } from "#fastnode/runtime/task";
import {
  builtinWorkerExports,
  serverEntryExports as userExports,
} from "#fastnode/virtual/server-entry";

const fastnodeApp = useFastnodeApp();

export const fetch = fastnodeApp.fetch;

export const websocket = import.meta._websocket ? { resolve: resolveWebsocketHooks } : undefined;

if (import.meta._tasks) {
  startScheduleRunner({});
}

// Named exports of the server entry and the preset's built-in ones: the Worker exports of the
// miniflare runner (see `resolveExports` in `dev-worker.mjs`). Namespaced so they are not read as
// server options.
export const serverEntryExports = { ...builtinWorkerExports, ...userExports };

// Called by the dev worker when the runner shuts down (see `ipc.onClose` in `dev-worker.mjs`).
export const close = () => useFastnodeHooks().callHook("close");
