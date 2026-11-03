import { defineFastnodePreset } from "../_utils/preset.ts";
import { nodeCluster } from "./cluster.ts";

const nodeServer = defineFastnodePreset(
  {
    entry: "./node/runtime/node-server",
    serveStatic: true,
    commands: {
      preview: "node ./server/index.mjs",
    },
  },
  {
    name: "node-server" as const,
    aliases: ["node"],
  }
);

const nodeMiddleware = defineFastnodePreset(
  {
    entry: "./node/runtime/node-middleware",
  },
  {
    name: "node-middleware" as const,
  }
);

export default [nodeServer, nodeCluster, nodeMiddleware] as const;
