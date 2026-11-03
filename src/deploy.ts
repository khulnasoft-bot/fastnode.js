import type { Fastnode } from "fastnode/types";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import consola from "consola";
import { relative, resolve } from "pathe";

export interface DeployOptions {
  /** Extra arguments appended to the deploy command. */
  args?: string[];
}

export async function deploy(fastnode: Fastnode, opts: DeployOptions = {}): Promise<void> {
  const outputDir = fastnode.options.output.dir;
  if (!existsSync(resolve(outputDir, "fastnode.json"))) {
    throw new Error(
      `No build output found in \`${outputDir}\`. Make sure to build first before deploying.`
    );
  }

  const deployCommand = fastnode.options.commands.deploy;
  if (!deployCommand) {
    throw new Error(
      `The \`${fastnode.options.preset}\` preset does not have a default deploy command.\n\nTry using a different preset with the \`--preset\` option, or configure a deploy command in the Fastnode config, or deploy manually.`
    );
  }

  if (typeof deployCommand === "function") {
    await deployCommand(fastnode, opts);
    return;
  }

  const cwd = fastnode.options.rootDir;
  const command = [
    deployCommand.replace(/(^|[\s:])\.\/(\S*)/g, `$1${relative(cwd, outputDir) || "."}/$2`),
    ...(opts.args || []),
  ].join(" ");

  consola.info(`$ ${command}`);
  execSync(command, { stdio: "inherit", cwd });
}
