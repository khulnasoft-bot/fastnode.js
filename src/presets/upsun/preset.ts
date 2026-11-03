import { defineFastnodePreset } from "../_utils/preset.ts";

const upsun = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "upsun" as const,
    aliases: ["platform-sh"],
  }
);

export default [upsun] as const;
