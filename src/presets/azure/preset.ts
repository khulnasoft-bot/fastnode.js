import { defineFastnodePreset } from "../_utils/preset.ts";
import type { Fastnode } from "fastnode/types";
import { setupAzureFunctions, writeFunctionFiles } from "./_functions.ts";
import { writeSWARoutes } from "./utils.ts";

export type { AzureOptions as PresetOptions } from "./types.ts";

const azureSWA = defineFastnodePreset(
  {
    entry: "./azure/runtime/azure-swa.{version}",
    output: {
      serverDir: "{{ output.dir }}/server/functions",
      publicDir: "{{ output.dir }}/public/{{ baseURL }}",
    },
    commands: {
      preview: "npx @azure/static-web-apps-cli start ./public --api-location ./server",
    },
    hooks: {
      async "build:before"(fastnode: Fastnode) {
        await setupAzureFunctions(fastnode);
      },
      async compiled(ctx: Fastnode) {
        await writeSWARoutes(ctx);
        await writeFunctionFiles(ctx);
      },
    },
  },
  {
    name: "azure-swa" as const,
    stdName: "azure_static",
  }
);

export default [azureSWA] as const;
