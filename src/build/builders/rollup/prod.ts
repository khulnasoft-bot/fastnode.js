import type { Fastnode, RollupConfig } from "fastnode/types";
import { formatCompatibilityDate } from "compatx";
import { scanHandlers } from "../../../core/application/scan.ts";
import { generateFSTree } from "../../../utils/fs-tree.ts";
import { writeBuildInfo } from "../../info.ts";
import { formatRollupError } from "./error.ts";
import { compressPublicAssets } from "../../../utils/compress.ts";
import type { RollupOptions, RollupOutput } from "rollup";
import { importRollup } from "./_import.ts";

export async function buildProduction(fastnode: Fastnode, rollupConfig: RollupConfig) {
  const rollup = await importRollup(fastnode);

  const buildStartTime = Date.now();

  await scanHandlers(fastnode);

  if (fastnode.options.compressPublicAssets) {
    await compressPublicAssets(fastnode);
  }

  let output: RollupOutput | undefined;
  if (!fastnode.options.static) {
    fastnode.logger.info(
      `Building server (builder: \`rollup\`, preset: \`${fastnode.options.preset}\`, compatibility date: \`${formatCompatibilityDate(fastnode.options.compatibilityDate)}\`)`
    );
    const build = await rollup.rollup(rollupConfig as RollupOptions).catch((error) => {
      fastnode.logger.error(formatRollupError(error));
      throw error;
    });

    output = await build.write(rollupConfig.output!);
  }

  const buildInfo = await writeBuildInfo(fastnode, output);

  if (!fastnode.options.static) {
    if (fastnode.options.logging.buildSuccess) {
      fastnode.logger.success(`Server built in ${Date.now() - buildStartTime}ms`);
    }
    if (fastnode.options.logLevel > 1) {
      process.stdout.write(
        (await generateFSTree(fastnode.options.output.serverDir, {
          compressedSizes: fastnode.options.logging.compressedSizes,
        })) || ""
      );
    }
  }

  await fastnode.hooks.callHook("compiled", fastnode);

  // Show deploy and preview hints
  fastnode.logger.success("You can preview this build using `npx fastnode preview`");
  if (fastnode.options.commands.deploy) {
    fastnode.logger.success("You can deploy this build using `npx fastnode deploy --prebuilt`");
  }
}
