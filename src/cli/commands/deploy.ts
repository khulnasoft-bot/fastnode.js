import { defineCommand } from "citty";
import type { DateString } from "compatx";
import { resolve } from "pathe";
import consola from "consola";
import {
  build,
  copyPublicAssets,
  createFastnode,
  deploy,
  getBuildInfo,
  prepare,
  prerender,
} from "fastnode/builder";
import { buildArgs } from "./build.ts";

export default defineCommand({
  meta: {
    name: "deploy",
    description: "Build and deploy fastnode project for production",
  },
  args: {
    ...buildArgs,
    prebuilt: {
      type: "boolean",
      description: "Skip the build step and deploy the existing build",
    },
  },
  async run({ args, rawArgs }) {
    const rootDir = resolve((args.dir || args._dir || ".") as string);

    let preset = args.preset;
    let envName = args.envName;
    let outputDir: string | undefined;
    if (args.prebuilt) {
      const lastBuild = await getBuildInfo({ rootDir });
      if (!lastBuild.buildInfo) {
        consola.error("No build info found, cannot deploy.");
        process.exit(1);
      }
      if (preset && preset !== lastBuild.buildInfo.preset) {
        consola.warn(
          `Ignoring \`--preset ${preset}\` and using \`${lastBuild.buildInfo.preset}\` from the existing build.`
        );
      }
      preset = lastBuild.buildInfo.preset;
      if (lastBuild.buildInfo.envName) {
        if (envName && envName !== lastBuild.buildInfo.envName) {
          consola.warn(
            `Ignoring \`--envName ${envName}\` and using \`${lastBuild.buildInfo.envName}\` from the existing build.`
          );
        }
        envName = lastBuild.buildInfo.envName;
      }
      outputDir = lastBuild.outputDir;
    }

    const fastnode = await createFastnode(
      {
        rootDir,
        dev: false,
        minify: args.minify,
        preset,
        builder: args.builder as "rollup" | "rolldown" | "vite",
        output: outputDir ? { dir: outputDir } : undefined,
      },
      {
        compatibilityDate: args.compatibilityDate as DateString,
        c12: { envName },
      }
    );

    const extraArgs = rawArgs.includes("--") ? rawArgs.slice(rawArgs.indexOf("--") + 1) : [];

    try {
      if (!args.prebuilt) {
        await prepare(fastnode);
        // The vite builder copies public assets and prerenders after building the client
        if (fastnode.options.builder !== "vite") {
          await copyPublicAssets(fastnode);
          await prerender(fastnode);
        }
        await build(fastnode);
      }
      await deploy(fastnode, { args: extraArgs });
    } catch (error) {
      consola.error(error);
      process.exitCode = 1;
    } finally {
      await fastnode.close();
    }
  },
});
