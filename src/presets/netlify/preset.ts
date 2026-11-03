import { promises as fsp } from "node:fs";
import { defineFastnodePreset } from "../_utils/preset.ts";
import type { Fastnode } from "fastnode/types";
import { join } from "pathe";
import { unenvDeno } from "../deno/unenv/preset.ts";
import { extendEnv } from "../../build/env.ts";
import {
  generateNetlifyEdgeFunction,
  generateNetlifyFunction,
  writeConfig,
  writeHeaders,
  writeRedirects,
} from "./utils.ts";

export type { NetlifyOptions as PresetOptions } from "./types.ts";

// Netlify functions
const netlify = defineFastnodePreset(
  {
    entry: "./netlify/runtime/netlify",
    manifest: {
      deploymentId: process.env.DEPLOY_ID,
    },
    output: {
      dir: "{{ rootDir }}/.netlify/v1/functions",
      publicDir: "{{ rootDir }}/dist/{{ baseURL }}",
    },
    prerender: {
      // Prevents an unnecessary redirect from /page/ to /page when accessing prerendered content.
      // Reference: https://answers.netlify.com/t/support-guide-how-can-i-alter-trailing-slash-behaviour-in-my-urls-will-enabling-pretty-urls-help/31191
      // Reference: https://fastnode.khulnasoft.com/config/routing#prerender
      autoSubfolderIndex: false,
    },
    rollupConfig: {
      output: {
        entryFileNames: "main.mjs",
      },
    },
    hooks: {
      async compiled(fastnode: Fastnode) {
        await writeHeaders(fastnode);
        await writeRedirects(fastnode);
        await writeConfig(fastnode, join(fastnode.options.output.dir, "../config.json"));

        await fsp.writeFile(
          join(fastnode.options.output.dir, "server", "server.mjs"),
          generateNetlifyFunction(fastnode)
        );
      },
    },
  },
  {
    name: "netlify" as const,
    stdName: "netlify",
  }
);

// Netlify edge
const netlifyEdge = defineFastnodePreset(
  {
    extends: "base-worker",
    entry: "./netlify/runtime/netlify-edge",
    manifest: {
      deploymentId: process.env.DEPLOY_ID,
    },
    exportConditions: ["deno"],
    output: {
      serverDir: "{{ rootDir }}/.netlify/v1/edge-functions/server",
      publicDir: "{{ rootDir }}/dist/{{ baseURL }}",
    },
    prerender: {
      // Prevents an unnecessary redirect from /page/ to /page when accessing prerendered content.
      // Reference: https://answers.netlify.com/t/support-guide-how-can-i-alter-trailing-slash-behaviour-in-my-urls-will-enabling-pretty-urls-help/31191
      // Reference: https://fastnode.khulnasoft.com/config/routing#prerender
      autoSubfolderIndex: false,
    },
    rollupConfig: {
      output: {
        entryFileNames: "main.mjs",
        format: "esm",
        inlineDynamicImports: false,
      },
    },
    hooks: {
      "build:before": (fastnode: Fastnode) => {
        extendEnv(fastnode, unenvDeno);
      },
      async compiled(fastnode: Fastnode) {
        await writeHeaders(fastnode);
        await writeRedirects(fastnode);
        await writeConfig(fastnode, join(fastnode.options.output.serverDir, "../../config.json"));

        await fsp.writeFile(
          join(fastnode.options.output.serverDir, "server.mjs"),
          generateNetlifyEdgeFunction(fastnode)
        );
      },
    },
  },
  {
    name: "netlify-edge" as const,
  }
);

const netlifyStatic = defineFastnodePreset(
  {
    extends: "static",
    manifest: {
      deploymentId: process.env.DEPLOY_ID,
    },
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ rootDir }}/dist/{{ baseURL }}",
    },
    prerender: {
      // Prevents an unnecessary redirect from /page/ to /page when accessing prerendered content.
      // Reference: https://answers.netlify.com/t/support-guide-how-can-i-alter-trailing-slash-behaviour-in-my-urls-will-enabling-pretty-urls-help/31191
      // Reference: https://fastnode.khulnasoft.com/config/routing#prerender
      autoSubfolderIndex: false,
    },
    commands: {
      preview: "npx serve ./",
    },
    hooks: {
      async compiled(fastnode: Fastnode) {
        await writeHeaders(fastnode);
        await writeRedirects(fastnode);
      },
    },
  },
  {
    name: "netlify-static" as const,
    stdName: "netlify",
    static: true,
  }
);

export default [netlify, netlifyEdge, netlifyStatic] as const;
