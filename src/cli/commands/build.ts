import { defineCommand } from "citty";
import type { DateString } from "compatx";
import { build, copyPublicAssets, createFastnode, prepare, prerender } from "fastnode/builder";
import { resolve } from "pathe";
import { commonArgs } from "../common.ts";

export const buildArgs = {
  ...commonArgs,
  minify: {
    type: "boolean",
    description:
      "Minify the output (overrides preset defaults you can also use `--no-minify` to disable).",
  },
  preset: {
    type: "string",
    description:
      "The build preset to use (you can also use `FASTNODE_PRESET` environment variable).",
  },
  builder: {
    type: "string",
    description: "The builder to use (you can also use `FASTNODE_BUILDER` environment variable).",
  },
  compatibilityDate: {
    type: "string",
    description:
      "The date to use for preset compatibility (you can also use `FASTNODE_COMPATIBILITY_DATE` environment variable).",
  },
  envName: {
    type: "string",
    description:
      "The environment name used to apply `$env.<name>` config overrides and exposed as `import.meta.envName` (default: `production`).",
  },
} as const;

export default defineCommand({
  meta: {
    name: "build",
    description: "Build fastnode project for production",
  },
  args: buildArgs,
  async run({ args }) {
    const rootDir = resolve((args.dir || args._dir || ".") as string);
    const fastnode = await createFastnode(
      {
        rootDir,
        dev: false,
        minify: args.minify,
        preset: args.preset,
        builder: args.builder as "rollup" | "rolldown" | "vite",
      },
      {
        compatibilityDate: args.compatibilityDate as DateString,
        c12: { envName: args.envName },
      }
    );
    await prepare(fastnode);
    // The vite builder copies public assets and prerenders after building the client
    if (fastnode.options.builder !== "vite") {
      await copyPublicAssets(fastnode);
      await prerender(fastnode);
    }
    await build(fastnode);
    await fastnode.close();
  },
});
