import { defineFastnodePreset } from "../_utils/preset.ts";

const fastnodeServe = defineFastnodePreset(
  {
    entry: "./_fastnode/runtime/fastnode-serve",
    serveStatic: false,
  },
  {
    name: "fastnode-serve" as const,
  }
);

export default [fastnodeServe] as const;
