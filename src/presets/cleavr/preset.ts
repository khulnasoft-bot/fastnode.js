import { defineFastnodePreset } from "../_utils/preset.ts";

const cleavr = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "cleavr" as const,
    stdName: "cleavr",
  }
);

export default [cleavr] as const;
