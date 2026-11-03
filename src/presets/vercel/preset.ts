import { defineFastnodePreset } from "../_utils/preset.ts";
import type { Fastnode } from "fastnode/types";
import { presetsDir } from "#fastnode/meta";
import { join } from "pathe";
import { importDep } from "../../utils/dep.ts";
import { generateFunctionFiles, generateStaticFiles, resolveVercelRuntime } from "./utils.ts";
import { setupImmutableStaticFiles, generateImmutableManifest } from "./immutable.ts";
import { vercelDevModule } from "./dev.ts";
import { getVercelSchedulesMode, setupVercelSchedules } from "./schedules.ts";

import type { VercelFunctionTrigger } from "./types.ts";

export type { VercelOptions as PresetOptions } from "./types.ts";

// https://vercel.com/docs/build-output-api/v3

const vercel = defineFastnodePreset(
  {
    entry: "./vercel/runtime/vercel.{format}",
    manifest: {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    },
    vercel: {
      skewProtection: !!process.env.VERCEL_SKEW_PROTECTION_ENABLED,
      immutableStaticFiles: !!process.env.FASTNODE_VERCEL_IMMUTABLE_STATIC_FILES_ENABLED,
      cronHandlerRoute: "/_vercel/cron",
    },
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      serverDir: "{{ output.dir }}/functions/__server.func",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      preview: "npx srvx --static ../../static ./functions/__server.func/index.mjs",
      deploy: "npx vercel deploy --prebuilt",
    },
    hooks: {
      "build:before": async (fastnode: Fastnode) => {
        const logger = fastnode.logger.withTag("vercel");

        // Immutable static files
        setupImmutableStaticFiles(fastnode);

        // Runtime
        const runtime = await resolveVercelRuntime(fastnode);
        if (runtime.startsWith("bun") && !fastnode.options.exportConditions!.includes("bun")) {
          fastnode.options.exportConditions!.push("bun");
        }
        logger.info(`Using \`${runtime}\` runtime.`);

        // Entry handler format
        let serverFormat = fastnode.options.vercel?.entryFormat;
        if (!serverFormat) {
          const hasNodeHandler = fastnode.routing.routes.routes
            .flatMap((r) => r.data)
            .some((h) => h.format === "node");
          serverFormat = hasNodeHandler ? "node" : "web";
        }
        logger.info(`Using \`${serverFormat}\` entry format.`);
        fastnode.options.entry = fastnode.options.entry.replace("{format}", serverFormat);

        // Export tracing-channel spans to the Vercel runtime. Registered first
        // (unshift) so it subscribes to the traced channels at startup, before
        // any request is handled.
        if (fastnode.options.tracingChannel) {
          fastnode.options.plugins ??= [];
          fastnode.options.plugins.unshift(join(presetsDir, "vercel/runtime/telemetry/plugin"));
        }

        // Scheduled tasks
        if (getVercelSchedulesMode(fastnode.options)) {
          setupVercelSchedules(fastnode);
        } else if (
          fastnode.options.experimental.tasks &&
          Object.keys(fastnode.options.scheduledTasks || {}).length > 0
        ) {
          fastnode.options.handlers.push({
            route: fastnode.options.vercel!.cronHandlerRoute || "/_vercel/cron",
            lazy: true,
            handler: join(presetsDir, "vercel/runtime/cron-handler"),
          });
        }

        // Queue consumer handler
        const queues = fastnode.options.vercel?.queues;
        if (queues?.triggers?.length) {
          await importDep({
            id: "@vercel/queue",
            dir: fastnode.options.rootDir,
            deps: fastnode.options.deps,
          });

          const handlerRoute = queues.handlerRoute || "/_vercel/queues/consumer";

          fastnode.options.handlers.push({
            route: handlerRoute,
            lazy: true,
            handler: join(presetsDir, "vercel/runtime/queue-handler"),
          });

          const queueTriggers: VercelFunctionTrigger[] = queues.triggers.map(
            ({ topic, ...opts }) => ({ type: "queue/v2beta", topic, ...opts })
          );
          fastnode.options.vercel ??= {};
          fastnode.options.vercel.functionRules ??= {};
          const existingRule = fastnode.options.vercel.functionRules[handlerRoute];
          fastnode.options.vercel.functionRules[handlerRoute] = {
            ...existingRule,
            experimentalTriggers: [...(existingRule?.experimentalTriggers || []), ...queueTriggers],
          };
        }
      },
      async compiled(fastnode: Fastnode) {
        await generateFunctionFiles(fastnode);
        await generateImmutableManifest(fastnode);
      },
    },
  },
  {
    name: "vercel" as const,
    stdName: "vercel",
  }
);

const vercelStatic = defineFastnodePreset(
  {
    extends: "static",
    manifest: {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    },
    vercel: {
      skewProtection: !!process.env.VERCEL_SKEW_PROTECTION_ENABLED,
      immutableStaticFiles: !!process.env.FASTNODE_VERCEL_IMMUTABLE_STATIC_FILES_ENABLED,
    },
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      preview: "npx serve ./static",
    },
    hooks: {
      "build:before": (fastnode: Fastnode) => {
        // Immutable static files (opt-in, guarded by Vercel platform support)
        setupImmutableStaticFiles(fastnode);
      },
      async compiled(fastnode: Fastnode) {
        await generateStaticFiles(fastnode);
        await generateImmutableManifest(fastnode);
      },
    },
  },
  {
    name: "vercel-static" as const,
    stdName: "vercel",
    static: true,
  }
);

export const vercelDev = defineFastnodePreset(
  {
    extends: "fastnode-dev",
    devServer: { runner: "vercel" },
    modules: [vercelDevModule],
  },
  {
    name: "vercel-dev" as const,
    aliases: ["vercel"],
    dev: true,
  }
);

export default [vercel, vercelStatic, vercelDev] as const;
