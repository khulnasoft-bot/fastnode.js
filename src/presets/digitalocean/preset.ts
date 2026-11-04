import { defineFastnodePreset } from "../_utils/preset.ts";

const digitalOcean = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "digital-ocean" as const,
  }
);

export default [digitalOcean] as const;
