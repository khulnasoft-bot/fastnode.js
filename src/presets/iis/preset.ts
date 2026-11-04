import { defineFastnodePreset } from "../_utils/preset.ts";
import type { Fastnode } from "fastnode/types";
import { writeIISFiles, writeIISNodeFiles } from "./utils.ts";

export type { IisOptions as PresetOptions } from "./types.ts";

const iisHandler = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
    hooks: {
      async compiled(fastnode: Fastnode) {
        await writeIISFiles(fastnode);
      },
    },
  },
  {
    name: "iis-handler" as const,
  }
);

const iisNode = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
    hooks: {
      async compiled(fastnode: Fastnode) {
        await writeIISNodeFiles(fastnode);
      },
    },
  },
  {
    name: "iis-node" as const,
  }
);

export default [iisHandler, iisNode] as const;
