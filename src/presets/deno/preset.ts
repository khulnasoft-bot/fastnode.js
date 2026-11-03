import { defineFastnodePreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import { resolve } from "pathe";
import { builtinModules } from "node:module";

const denoServer = defineFastnodePreset(
  {
    entry: "./deno/runtime/deno-server",
    serveStatic: true,
    exportConditions: ["deno"],
    commands: {
      preview: "deno -A ./server/index.mjs",
    },
    rollupConfig: {
      external: (id) =>
        id.startsWith("https://") || id.startsWith("node:") || builtinModules.includes(id),
      output: {
        hoistTransitiveImports: false,
      },
    },
    hooks: {
      async compiled(fastnode) {
        // https://docs.deno.com/runtime/fundamentals/configuration/
        const denoJSON = {
          tasks: {
            start: "deno run -A ./server/index.mjs",
          },
        };
        await writeFile(
          resolve(fastnode.options.output.dir, "deno.json"),
          JSON.stringify(denoJSON, null, 2)
        );
      },
    },
  },
  {
    name: "deno-server" as const,
    stdName: "deno-deploy",
    aliases: ["deno"],
  }
);

export default [denoServer] as const;
