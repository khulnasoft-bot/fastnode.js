import type { Fastnode } from "fastnode/types";
import type { H3Event } from "h3";
import { HTTPError } from "h3";
import { presetsDir } from "#fastnode/meta";
import { resolveModulePath } from "exsolve";
import { joinURL } from "ufo";
import { isLocalDevRequest } from "../../dev/_request.ts";
import {
  SCHEDULE_HANDLER_ROUTE,
  SCHEDULE_TRIGGER,
  getScheduleFunctionPath,
  getVercelBuildOutputSchedules,
  getVercelSchedulesMode,
  registerScheduleHandler,
} from "./schedules.ts";

import type { VercelFunctionTrigger, VercelSchedule } from "./types.ts";

/** Dev-only route that `vercel dev` fetches to register the schedules with its broker. */
const DEV_MANIFEST_ROUTE = "/_vercel/dev-manifest";
const DEV_MANIFEST_ID = "#fastnode/virtual/vercel-dev-manifest";

export interface VercelDevManifest {
  /** Functions with a deployment identity, and where the dev server serves them. Empty in `public` mode. */
  functions: {
    /** Build Output API function path, without a leading slash or `.func` suffix. */
    outputPath: string;
    invocation: { type: "http"; pathname: string };
    experimentalTriggers: VercelFunctionTrigger[];
  }[];
  /** Build Output API `schedules` keyed by name, as emitted by `fastnode build`. */
  schedules: Record<string, VercelSchedule>;
}

/**
 * Configure local development emulation for the Vercel preset.
 *
 * When `vercel.queues.triggers` is configured, propagates the trigger list
 * to runtime config and injects a runtime plugin that binds each topic to
 * the `vercel:queue` hook through env-runner's queue dev bridge.
 *
 * When Vercel Schedules is enabled and `vercel dev` provides its local Schedules
 * broker, serves the scheduled task handler and hands scheduling over to the broker.
 *
 */
export async function vercelDevModule(fastnode: Fastnode) {
  if (!fastnode.options.dev) {
    return;
  }

  setupVercelSchedulesDev(fastnode);
  setupVercelQueuesDev(fastnode);
}

/**
 * Under `vercel dev`, serves the dev manifest that `vercel dev` fetches to register the
 * scheduled tasks with its local Schedules broker, and the handler the broker invokes. The
 * broker then owns task scheduling instead of the in-process scheduler.
 */
export function setupVercelSchedulesDev(fastnode: Fastnode) {
  if (!process.env.VERCEL_SCHEDULE_DEV_API_VERSION) {
    return;
  }

  fastnode.options.virtual[DEV_MANIFEST_ID] = () =>
    /* js */ `export default () => (${JSON.stringify(getVercelDevManifest(fastnode))});`;
  fastnode.options.handlers.push({
    route: DEV_MANIFEST_ROUTE,
    method: "GET",
    lazy: true,
    handler: DEV_MANIFEST_ID,
  });

  const localRoutes = [DEV_MANIFEST_ROUTE];
  const mode = getVercelSchedulesMode(fastnode.options);
  if (mode) {
    localRoutes.push(registerScheduleHandler(fastnode, mode));
    // The broker invokes the handler on schedule, so the in-process scheduler must not.
    fastnode.options.scheduler.runner = false;
    fastnode.logger
      .withTag("vercel")
      .info("Scheduled tasks are run by the `vercel dev` Schedules broker.");
  }
  assertLocalDevRoutes(fastnode, localRoutes);
}

function setupVercelQueuesDev(fastnode: Fastnode) {
  const triggers = fastnode.options.vercel?.queues?.triggers;
  if (!triggers?.length) {
    return;
  }

  if (fastnode.options.devServer.runner !== "vercel") {
    throw new Error(
      `[vercel:queue] Local queue delivery requires the \`vercel\` dev runner, but \`devServer.runner\` is set to "${fastnode.options.devServer.runner}". Remove the \`devServer.runner\` override in your \`fastnode.config.ts\` or set it explicitly to \`"vercel"\`.`
    );
  }

  // Propagate triggers to the runtime plugin via runtimeConfig.
  fastnode.options.runtimeConfig.vercel = {
    ...fastnode.options.runtimeConfig.vercel,
    queues: {
      triggers: triggers.map((t) => ({ ...t })),
    },
  };

  fastnode.options.plugins = fastnode.options.plugins || [];
  fastnode.options.plugins.unshift(
    resolveModulePath("./vercel/runtime/queue.dev", {
      from: presetsDir,
      extensions: [".mjs", ".ts"],
    })
  );
}

/** The functions and schedules that `vercel dev` registers with its local Schedules broker. */
function getVercelDevManifest(fastnode: Fastnode): VercelDevManifest {
  const schedules = getVercelBuildOutputSchedules(fastnode);
  if (
    Object.keys(schedules).length === 0 ||
    getVercelSchedulesMode(fastnode.options) === "public"
  ) {
    return { functions: [], schedules };
  }
  return {
    functions: [
      {
        outputPath: getScheduleFunctionPath(fastnode),
        invocation: {
          type: "http",
          pathname: joinURL(fastnode.options.baseURL, SCHEDULE_HANDLER_ROUTE),
        },
        experimentalTriggers: [SCHEDULE_TRIGGER],
      },
    ],
    schedules,
  };
}

/**
 * Rejects non-local requests to the dev-only routes before they reach the worker, like the
 * `/_fastnode/tasks` routes: the dev server binds all interfaces by default.
 */
function assertLocalDevRoutes(fastnode: Fastnode, routes: string[]) {
  const assertLocal = (event: H3Event) => {
    if (!isLocalDevRequest(event)) {
      throw new HTTPError({ statusText: "Forbidden IP", status: 403 });
    }
  };
  for (const route of routes) {
    for (const pattern of [route, joinURL(route, "**")]) {
      fastnode.options.devHandlers.push({
        route: joinURL(fastnode.options.baseURL, pattern),
        middleware: true,
        handler: assertLocal,
      });
    }
  }
}
