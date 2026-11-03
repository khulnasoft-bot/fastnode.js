import { defineFastnodePreset } from "../_utils/preset.ts";

const renderCom = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "render-com" as const,
  }
);

export default [renderCom] as const;
