import { defineFastnodePreset } from "../_utils/preset.ts";

const heroku = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "heroku" as const,
  }
);

export default [heroku] as const;
