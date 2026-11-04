import { defineFastnodePreset } from "../_utils/preset.ts";
import { writeEdgeOneConfig } from "./utils.ts";
import type { Fastnode } from "fastnode/types";

const edgeone = defineFastnodePreset(
  {
    extends: "node-server",
    entry: "./edgeone/runtime/edgeone",
    serveStatic: false, // EdgeOne serves static assets from `.edgeone/assets/`
    output: {
      dir: "{{ rootDir }}/.edgeone",
      serverDir: "{{ output.dir }}/cloud-functions/ssr-node",
      publicDir: "{{ output.dir }}/assets/{{ baseURL }}",
    },
    rollupConfig: {
      output: {
        entryFileNames: "handler.js",
      },
    },
    hooks: {
      async compiled(fastnode: Fastnode) {
        await writeEdgeOneConfig(fastnode);
      },
    },
  },
  {
    name: "edgeone-pages" as const,
    aliases: ["edgeone"] as const,
    stdName: "edgeone_pages",
  }
);

export default [edgeone] as const;
