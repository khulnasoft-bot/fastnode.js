import { consola } from "consola";
import { Hookable, createDebugger } from "hookable";
import type {
  LoadConfigOptions,
  Fastnode,
  FastnodeConfig,
  FastnodeDynamicConfig,
  FastnodeBuildConfig,
  FastnodeHooks,
  RollupConfig,
} from "fastnode/types";
import { version as fastnodeVersion } from "#fastnode/meta";
import { loadOptions } from "../../config/loader.ts";
import { updateFastnodeConfig } from "../../config/update.ts";
import { installModules } from "./module.ts";
import { scanAndSyncOptions, scanHandlers } from "./scan.ts";
import { initFastnodeRouting } from "../routing/routing.ts";
import { registerFastnodeInstance } from "../lifecycle/global.ts";

export async function createFastnode(
  config: FastnodeConfig = {},
  opts: LoadConfigOptions = {}
): Promise<Fastnode> {
  // Resolve options
  const options = await loadOptions(config, opts);

  // Create fastnode context
  const hooks = new Hookable<FastnodeHooks>();
  hooks.deprecateHooks({ "rollup:reload": { to: "build:reload" } });
  hooks.hook("build:config", callRollupBeforeHooks);
  let closePromise: Promise<void> | undefined;
  const fastnode: Fastnode = {
    meta: {
      version: fastnodeVersion,
      majorVersion: 3,
    },
    options,
    hooks,
    vfs: new Map(),
    routing: {} as any,
    logger: consola.withTag("fastnode"),
    scannedHandlers: [],
    fetch: () => {
      throw new Error("no dev server attached!");
    },
    close: () => (closePromise ??= Promise.resolve(fastnode.hooks.callHook("close"))),
    async updateConfig(config: FastnodeDynamicConfig) {
      updateFastnodeConfig(fastnode, config);
    },
  };

  // Global setup
  registerFastnodeInstance(fastnode);

  // Init routers
  initFastnodeRouting(fastnode);

  // Scan dirs (plugins, tasks, modules) and sync options
  // TODO: Make it side-effect free to allow proper watching
  await scanAndSyncOptions(fastnode);

  // Debug
  if (fastnode.options.debug) {
    createDebugger(hooks, { tag: "fastnode" });
  }

  // Logger
  if (fastnode.options.logLevel !== undefined) {
    fastnode.logger.level = fastnode.options.logLevel;
  }

  // Hooks
  fastnode.hooks.addHooks(fastnode.options.hooks);

  // Scan and install modules
  await installModules(fastnode);

  // Ensure initial handlers are populated
  await scanHandlers(fastnode);

  // Sync routers
  fastnode.routing.sync();

  return fastnode;
}

let _rollupBeforeWarned = false;

function callRollupBeforeHooks(fastnode: Fastnode, config: FastnodeBuildConfig) {
  return fastnode.hooks.callHookWith(
    async (fns, args) => {
      if (fns.length === 0) {
        return;
      }
      if (!_rollupBeforeWarned) {
        _rollupBeforeWarned = true;
        fastnode.logger.warn(
          "The `rollup:before` hook is deprecated. Use `build:config` instead (the config is passed as `{ rollup }` or `{ rolldown }`)."
        );
      }
      for (const fn of fns) {
        await fn(...args);
      }
    },
    "rollup:before",
    [fastnode, (config.rollup ?? config.rolldown) as RollupConfig]
  );
}
