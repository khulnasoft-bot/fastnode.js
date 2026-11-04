import type { Fastnode } from "fastnode/types";
import type { OutputOptions, RolldownOptions } from "rolldown";
import { formatCompatibilityDate } from "compatx";

import { relative } from "pathe";
import { scanHandlers } from "../../../core/application/scan.ts";
import { generateFSTree } from "../../../utils/fs-tree.ts";
import { writeBuildInfo } from "../../info.ts";
import { compressPublicAssets } from "../../../utils/compress.ts";
import type { RolldownOutput } from "rolldown";

export async function buildProduction(
  fastnode: Fastnode,
  config: RolldownOptions,
  rolldown: typeof import("rolldown")
) {
  const buildStartTime = Date.now();

  await scanHandlers(fastnode);

  if (fastnode.options.compressPublicAssets) {
    await compressPublicAssets(fastnode);
  }

  let output: RolldownOutput | undefined;
  if (!fastnode.options.static) {
    fastnode.logger.info(
      `Building server (builder: \`rolldown\`, preset: \`${fastnode.options.preset}\`, compatibility date: \`${formatCompatibilityDate(fastnode.options.compatibilityDate)}\`)`
    );
    const build = await rolldown.rolldown(config);
    output = (await build.write(config.output as OutputOptions)) as RolldownOutput;
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
  const rOutput = relative(process.cwd(), fastnode.options.output.dir);
  const rewriteRelativePaths = (input: string) => {
    return input.replace(/([\s:])\.\/(\S*)/g, `$1${rOutput}/$2`);
  };
  const previewCommand = fastnode.options.framework.previewCommand || "npx fastnode preview";
  fastnode.logger.success(`You can preview this build using \`${previewCommand}\``);
  if (fastnode.options.commands.deploy) {
    const deployCommand =
      fastnode.options.framework.deployCommand || "npx fastnode deploy --prebuilt";
    fastnode.logger.success(
      rewriteRelativePaths(`You can deploy this build using \`${deployCommand}\``)
    );
  }
}
