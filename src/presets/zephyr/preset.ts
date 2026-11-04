import { defineFastnodePreset } from "../_utils/preset.ts";
import type { Fastnode } from "fastnode/types";
import { unenvCfExternals, unenvCfNodeCompat } from "../cloudflare/unenv/preset.ts";
import { extendEnv } from "../../build/env.ts";
import { resolve } from "pathe";
import { importDep } from "../../utils/dep.ts";

export type { ZephyrOptions as PresetOptions } from "./types.ts";
const LOGGER_TAG = "zephyr-fastnode-preset";
const zephyr = defineFastnodePreset(
  {
    extends: "base-worker",
    entry: "./zephyr/runtime/server",
    output: {
      publicDir: "{{ output.dir }}/client/{{ baseURL }}",
    },
    exportConditions: ["node"],
    minify: false,
    rollupConfig: {
      output: {
        format: "esm",
        exports: "named",
        inlineDynamicImports: false,
      },
    },
    wasm: {
      lazy: false,
      esmImport: true,
    },
    commands: {
      deploy: deployToZephyr,
    },
    hooks: {
      "build:before": (fastnode: Fastnode) => {
        extendEnv(fastnode, unenvCfExternals);
        extendEnv(fastnode, unenvCfNodeCompat);
      },
      compiled: async (fastnode: Fastnode) => {
        if (!fastnode.options.zephyr?.deployOnBuild) {
          fastnode.logger.info(
            `[${LOGGER_TAG}] Skipping Zephyr deploy on build (use \`fastnode deploy\` or set \`zephyr.deployOnBuild\`).`
          );
          return;
        }
        await deployToZephyr(fastnode);
      },
    },
  },
  {
    name: "zephyr" as const,
  }
);

export default [zephyr] as const;

// --- internal ---

const deployed = new WeakSet<Fastnode>();

async function deployToZephyr(fastnode: Fastnode): Promise<void> {
  if (deployed.has(fastnode)) {
    fastnode.logger.info(`[${LOGGER_TAG}] Zephyr deployment already done during build.`);
    return;
  }
  try {
    const zephyrAgent = await importDep({
      id: "zephyr-agent",
      dir: fastnode.options.rootDir,
      deps: fastnode.options.deps,
    });

    const { deploymentUrl } = await zephyrAgent.uploadOutputToZephyr({
      rootDir: fastnode.options.rootDir,
      outputDir: fastnode.options.output.dir,
      baseURL: fastnode.options.baseURL,
      publicDir: resolve(fastnode.options.output.dir, fastnode.options.output.publicDir),
    });
    if (deploymentUrl) {
      fastnode.logger.success(`[${LOGGER_TAG}] Zephyr deployment succeeded: ${deploymentUrl}`);
    } else {
      fastnode.logger.success(`[${LOGGER_TAG}] Zephyr deployment succeeded.`);
    }
    deployed.add(fastnode);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new TypeError(`[${LOGGER_TAG}] ${String(error)}`);
  }
}
