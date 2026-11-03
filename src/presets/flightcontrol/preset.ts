import { defineFastnodePreset } from "../_utils/preset.ts";

const flightControl = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "flight-control" as const,
  }
);

export default [flightControl] as const;
