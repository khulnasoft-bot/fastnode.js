import { defineFastnodePreset } from "../_utils/preset.ts";

const fastnodePrerender = defineFastnodePreset(
  {
    entry: "./_fastnode/runtime/fastnode-prerenderer",
    serveStatic: true,
    output: {
      serverDir: "{{ buildDir }}/prerender",
    },
    externals: { noTrace: true },
  },
  {
    name: "fastnode-prerender" as const,
  }
);

export default [fastnodePrerender] as const;
