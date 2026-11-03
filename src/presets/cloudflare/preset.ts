import { defineFastnodePreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import type { Fastnode } from "fastnode/types";
import { join, resolve } from "pathe";
import { presetsDir } from "#fastnode/meta";
import { unenvCfExternals } from "./unenv/preset.ts";
import { extendEnv } from "../../build/env.ts";
import {
  enableNodeCompat,
  writeWranglerConfig,
  writeCFRoutes,
  writeCFHeaders,
  writeCFPagesRedirects,
  moveCFRedirects,
} from "./utils.ts";
import { setupDevEntryExports, setupEntryExports } from "./entry-exports.ts";
import { cloudflareOutputRewrites } from "./output-plugins.ts";

export type { CloudflareOptions as PresetOptions } from "./types.ts";

const cloudflarePages = defineFastnodePreset(
  {
    extends: "base-worker",
    entry: "./cloudflare/runtime/cloudflare-pages",
    exportConditions: ["workerd", "worker"],
    minify: false,
    commands: {
      preview: "npx wrangler --cwd ./ pages dev",
      deploy: "npx wrangler --cwd ./ pages deploy",
    },
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ output.dir }}/{{ baseURL }}",
      serverDir: "{{ output.dir }}/_worker.js",
    },
    alias: {
      // Hotfix: Cloudflare appends /index.html if mime is not found and things like ico are not in standard lite.js!
      // https://github.com/khulnasoft/fastnode/pull/933
      _mime: "mime/index.js",
    },
    wasm: {
      lazy: false,
      esmImport: true,
    },
    rollupConfig: {
      output: {
        entryFileNames: "index.js",
        format: "esm",
        inlineDynamicImports: false,
      },
      plugins: [cloudflareOutputRewrites()],
    },
    hooks: {
      "build:before": async (fastnode) => {
        extendEnv(fastnode, unenvCfExternals);
        await enableNodeCompat(fastnode);
        setupEntryExports(fastnode);
      },
      async compiled(fastnode: Fastnode) {
        await writeWranglerConfig(fastnode, "pages");
        await writeCFRoutes(fastnode);
        await writeCFHeaders(fastnode, "output");
        await writeCFPagesRedirects(fastnode);
      },
    },
  },
  {
    name: "cloudflare-pages" as const,
    stdName: "cloudflare_pages",
  }
);

const cloudflarePagesStatic = defineFastnodePreset(
  {
    extends: "static",
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ output.dir }}/{{ baseURL }}",
    },
    commands: {
      preview: "npx wrangler --cwd ./ pages dev",
      deploy: "npx wrangler --cwd ./ pages deploy",
    },
    hooks: {
      async compiled(fastnode: Fastnode) {
        await writeCFHeaders(fastnode, "output");
        await writeCFPagesRedirects(fastnode);
      },
    },
  },
  {
    name: "cloudflare-pages-static" as const,
    stdName: "cloudflare_pages",

    static: true,
  }
);

export const cloudflareDev = defineFastnodePreset(
  {
    extends: "fastnode-dev",
    devServer: {
      runner: "miniflare",
    },
    hooks: {
      "build:before": async (fastnode) => {
        if (fastnode.options.devServer.runner === "miniflare") {
          await setupMiniflareDev(fastnode);
        }
      },
    },
  },
  {
    name: "cloudflare-dev" as const,
    aliases: ["cloudflare-module", "cloudflare-durable", "cloudflare-pages"],
    dev: true,
  }
);

const cloudflareModule = defineFastnodePreset(
  {
    extends: "base-worker",
    entry: "./cloudflare/runtime/cloudflare-module",
    output: {
      publicDir: "{{ output.dir }}/public/{{ baseURL }}",
    },
    exportConditions: ["workerd", "worker"],
    minify: false,
    commands: {
      preview: "npx wrangler --cwd ./ dev",
      deploy: "npx wrangler --cwd ./ deploy",
    },
    rollupConfig: {
      output: {
        format: "esm",
        exports: "named",
        inlineDynamicImports: false,
      },
      plugins: [cloudflareOutputRewrites()],
    },
    wasm: {
      lazy: false,
      esmImport: true,
    },
    hooks: {
      "build:before": async (fastnode) => {
        extendEnv(fastnode, unenvCfExternals);
        await enableNodeCompat(fastnode);
        setupEntryExports(fastnode);
        setupTracingBridge(fastnode);
      },
      async compiled(fastnode: Fastnode) {
        await writeWranglerConfig(fastnode, "module");
        await writeCFHeaders(fastnode, "assets");
        await moveCFRedirects(fastnode);

        await writeFile(
          resolve(fastnode.options.output.dir, "package.json"),
          JSON.stringify({ private: true, main: "./server/index.mjs" }, null, 2)
        );
        await writeFile(
          resolve(fastnode.options.output.dir, "package-lock.json"),
          JSON.stringify({ lockfileVersion: 1 }, null, 2)
        );
      },
    },
  },
  {
    name: "cloudflare-module" as const,
    stdName: "cloudflare_workers",
  }
);

/** @deprecated `cloudflare-module` exports the `$DurableObject` class. */
const cloudflareDurable = defineFastnodePreset(
  {
    extends: "cloudflare-module",
    hooks: {
      "build:before": (fastnode) => {
        fastnode.logger.warn(
          "[cloudflare] The `cloudflare_durable` preset is deprecated. Use `cloudflare_module` instead: it exports the same `$DurableObject` class and forwards WebSocket upgrades to it when its binding is declared in your Wrangler configuration."
        );
      },
    },
  },
  {
    name: "cloudflare-durable" as const,
  }
);

export default [
  cloudflarePages,
  cloudflarePagesStatic,
  cloudflareModule,
  cloudflareDurable,
  cloudflareDev,
];

// Builds for workerd like the production presets
async function setupMiniflareDev(fastnode: Fastnode) {
  // Resolve packages for workerd (it rejects the CJS entries of the `node` condition)
  fastnode.options.exportConditions = [
    ...new Set([
      "workerd",
      "worker",
      ...fastnode.options.exportConditions!.filter((c) => c !== "node"),
    ]),
  ];
  extendEnv(fastnode, unenvCfExternals);
  await setupDevEntryExports(fastnode);
  // The bridge imports `cloudflare:workers`, only available in workerd
  setupTracingBridge(fastnode);
}

/**
 * Export tracing-channel spans as Cloudflare custom spans (`tracing.enterSpan`)
 * Registered first (unshift) so the bridge subscribes to the traced channels at
 * startup, before any request is handled.
 */
function setupTracingBridge(fastnode: Fastnode) {
  if (!fastnode.options.tracingChannel) {
    return;
  }
  fastnode.options.plugins ??= [];

  fastnode.options.plugins.unshift(join(presetsDir, "cloudflare/runtime/telemetry/plugin"));
}
