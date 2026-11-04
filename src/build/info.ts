import type { Fastnode, FastnodeBuildInfo, WorkerAddress } from "fastnode/types";
import { resolveModulePath } from "exsolve";
import { join, relative, resolve } from "pathe";
import { version as fastnodeVersion } from "#fastnode/meta";
import { presetsWithConfig } from "../presets/_types.gen.ts";
import { writeFile } from "../utils/fs.ts";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type { RolldownOutput } from "rolldown";
import type { RollupOutput } from "rollup";
import { BUILD_EXTENSIONS } from "./_extensions.ts";

const FASTNODE_WELLKNOWN_DIR = "node_modules/.fastnode";

export interface GetBuildInfoOptions {
  /** Project root directory used to locate the last build output. */
  rootDir?: string;
  /** Explicit build output directory, resolved relative to `rootDir` (skips the last build lookup). */
  outputDir?: string;
}

export async function getBuildInfo(
  opts: GetBuildInfoOptions
): Promise<
  | { outputDir?: undefined; buildInfo?: undefined }
  | { outputDir: string; buildInfo?: FastnodeBuildInfo }
> {
  const rootDir = resolve(opts.rootDir || ".");
  const outputDir = opts.outputDir
    ? resolve(rootDir, opts.outputDir)
    : await findLastBuildDir(rootDir);

  const isDir = await stat(outputDir)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!isDir) {
    return {};
  }

  const buildInfo = (await readFile(resolve(outputDir, "fastnode.json"), "utf8")
    .then(JSON.parse)
    .catch(() => undefined)) as FastnodeBuildInfo | undefined;

  return {
    outputDir,
    buildInfo,
  };
}

export async function findLastBuildDir(root: string): Promise<string> {
  const lastBuildLink = join(root, FASTNODE_WELLKNOWN_DIR, "last-build.json");
  const outputDir = await readFile(lastBuildLink, "utf8")
    .then(JSON.parse)
    .then((data) => resolve(lastBuildLink, data.outputDir || "../../../.output"))
    .catch(() => resolve(root, ".output"));
  return outputDir;
}

export async function writeBuildInfo(
  fastnode: Fastnode,
  output: RolldownOutput | RollupOutput | undefined
): Promise<FastnodeBuildInfo> {
  const serverEntryName = resolveFastnodeServerEntry(fastnode, output);

  const buildInfoPath = resolve(fastnode.options.output.dir, "fastnode.json");
  const buildInfo: FastnodeBuildInfo = {
    date: new Date().toJSON(),
    preset: fastnode.options.preset,
    envName: fastnode.options.envName,
    framework: fastnode.options.framework,
    versions: {
      fastnode: fastnodeVersion,
    },
    serverEntry: serverEntryName
      ? relative(
          fastnode.options.output.dir,
          join(fastnode.options.output.serverDir, serverEntryName)
        )
      : undefined,
    publicDir: relative(
      fastnode.options.output.dir,
      resolve(fastnode.options.output.dir, fastnode.options.output.publicDir)
    ),
    commands: {
      preview: fastnode.options.commands.preview,
      deploy:
        typeof fastnode.options.commands.deploy === "string"
          ? fastnode.options.commands.deploy
          : undefined,
    },
    config: {
      ...Object.fromEntries(presetsWithConfig.map((key) => [key, fastnode.options[key]])),
    },
  };

  await writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2), true);

  const lastBuild = join(fastnode.options.rootDir, FASTNODE_WELLKNOWN_DIR, "last-build.json");
  await mkdir(dirname(lastBuild), { recursive: true });
  await writeFile(
    lastBuild,
    JSON.stringify({
      outputDir: relative(lastBuild, fastnode.options.output.dir),
    })
  );
  return buildInfo;
}

export async function writeDevBuildInfo(
  fastnode: Fastnode,
  dev: { workerAddress?: WorkerAddress; url?: string }
): Promise<void> {
  const buildInfoPath = join(fastnode.options.rootDir, FASTNODE_WELLKNOWN_DIR, "fastnode.dev.json");
  const buildInfo: FastnodeBuildInfo = {
    date: new Date().toJSON(),
    preset: fastnode.options.preset,
    envName: fastnode.options.envName,
    framework: fastnode.options.framework,
    versions: {
      fastnode: fastnodeVersion,
    },
    dev: {
      pid: process.pid,
      ...dev,
    },
  };
  await writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2));
}

/** Build info of the dev server of the project, if its process is still running. */
export async function getDevBuildInfo(rootDir: string): Promise<FastnodeBuildInfo | undefined> {
  const buildInfo = (await readFile(
    join(rootDir, FASTNODE_WELLKNOWN_DIR, "fastnode.dev.json"),
    "utf8"
  )
    .then(JSON.parse)
    .catch(() => undefined)) as FastnodeBuildInfo | undefined;
  if (!buildInfo?.dev?.pid) {
    return;
  }
  try {
    process.kill(buildInfo.dev.pid, 0);
  } catch {
    return;
  }
  return buildInfo;
}

function resolveFastnodeServerEntry(
  fastnode: Fastnode,
  output: RolldownOutput | RollupOutput | undefined
): string | undefined {
  const entries = output?.output.filter((item) => item.type === "chunk" && item.isEntry) ?? [];
  if (entries.length < 2) {
    return entries[0]?.fileName;
  }
  const fastnodeEntry = resolve(
    (!fastnode.options.entry.startsWith("#") &&
      resolveModulePath(fastnode.options.entry, { try: true, extensions: BUILD_EXTENSIONS })) ||
      fastnode.options.entry
  );
  const match = entries.find(
    (item) =>
      item.type === "chunk" &&
      !!item.facadeModuleId &&
      resolve(item.facadeModuleId) === fastnodeEntry
  );
  if (!match) {
    fastnode.logger.warn(
      `Could not find the output chunk for Fastnode entry \`${fastnode.options.entry}\`. Using \`${entries[0]!.fileName}\` as server entry.`
    );
  }
  return (match || entries[0]!).fileName;
}
