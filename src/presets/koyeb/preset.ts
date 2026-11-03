import { defineFastnodePreset } from "../_utils/preset.ts";

const koyeb = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "koyeb" as const,
  }
);

export default [koyeb] as const;
