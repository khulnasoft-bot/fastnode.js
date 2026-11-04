import { runtimeDir } from "#fastnode/meta";
import { defineFastnodePreset } from "../_utils/preset.ts";
import { join } from "pathe";

const fastnodeDev = defineFastnodePreset(
  {
    entry: "./_fastnode/runtime/fastnode-dev",
    output: {
      dir: "{{ buildDir }}/dev",
      serverDir: "{{ buildDir }}/dev",
      publicDir: "{{ buildDir }}/dev",
    },
    handlers: [
      {
        route: "/_fastnode/tasks/**",
        lazy: true,
        handler: join(runtimeDir, "internal/routes/dev-tasks"),
      },
    ],
    externals: { noTrace: true },
    serveStatic: true,
    inlineDynamicImports: true, // externals plugin limitation
    sourcemap: true,
  },
  {
    name: "fastnode-dev" as const,
    dev: true,
  }
);

export default [fastnodeDev] as const;
