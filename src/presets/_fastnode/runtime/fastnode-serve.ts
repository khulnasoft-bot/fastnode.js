import "#fastnode/virtual/polyfills";

import { useFastnodeApp, useFastnodeHooks } from "fastnode/app";
import { startScheduleRunner } from "#fastnode/runtime/task";
import { trapUnhandledErrors } from "#fastnode/runtime/error/hooks";
import { resolveWebsocketHooks } from "#fastnode/runtime/app";
import { tracingSrvxPlugins } from "#fastnode/virtual/tracing";
import { serverEntryOptions } from "#fastnode/virtual/server-entry";

import type { AppEntry } from "env-runner";

const fastnodeApp = useFastnodeApp();
const fastnodeHooks = useFastnodeHooks();

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner({});
}

export default {
  ...serverEntryOptions,
  fetch: fastnodeApp.fetch,
  plugins: [...tracingSrvxPlugins],
  websocket: import.meta._websocket
    ? ({ resolve: resolveWebsocketHooks } as AppEntry["websocket"])
    : undefined,
  ipc: {
    onClose: () => fastnodeHooks.callHook("close"),
  },
} satisfies AppEntry;
