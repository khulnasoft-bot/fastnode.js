import { defineFastnodePreset } from "../_utils/preset.ts";

const zerops = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "zerops" as const,
  }
);

const zeropsStatic = defineFastnodePreset(
  {
    extends: "static",
    output: {
      dir: "{{ rootDir }}/.zerops/output",
      publicDir: "{{ output.dir }}/static",
    },
  },
  {
    name: "zerops-static" as const,

    static: true,
  }
);

export default [zerops, zeropsStatic] as const;
