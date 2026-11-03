import type { EnvRunnerData, EnvRunnerPluginOption } from "env-runner";
import type { FastnodeConfig } from "./config.ts";
import type { Fastnode } from "./fastnode.ts";
import type { PrerenderRoute } from "./prerender.ts";
import type { FastnodeBuildConfig, RollupConfig } from "./build.ts";

type HookResult = void | Promise<void>;

export interface FastnodeHooks {
  "build:before": (fastnode: Fastnode) => HookResult;
  /**
   * Called after the bundler config is resolved, right before bundling. Last chance to modify it.
   *
   * The config is passed as `{ builder, rollup }` or `{ builder, rolldown }`, depending on the
   * builder and bundler in use.
   */
  "build:config": (fastnode: Fastnode, config: FastnodeBuildConfig) => HookResult;
  "vite:compile:before": (fastnode: Fastnode) => HookResult;
  compiled: (fastnode: Fastnode) => HookResult;
  "dev:reload": (payload?: {
    entry?: string;
    workerData?: EnvRunnerData;
    /** Host-side env-runner plugins for the dev runner. */
    plugins?: EnvRunnerPluginOption[];
  }) => HookResult;
  "dev:start": () => HookResult;
  "dev:error": (cause?: unknown) => HookResult;
  /** Called when the Fastnode config is hot-reloaded to rebuild the server. */
  "build:reload": () => HookResult;
  restart: () => HookResult;
  close: () => HookResult;
  // Prerender
  "prerender:routes": (routes: Set<string>) => HookResult;
  "prerender:config": (config: FastnodeConfig) => HookResult;
  "prerender:init": (prerenderer: Fastnode) => HookResult;
  "prerender:generate": (route: PrerenderRoute, fastnode: Fastnode) => HookResult;
  "prerender:route": (route: PrerenderRoute) => HookResult;
  "prerender:done": (result: {
    prerenderedRoutes: PrerenderRoute[];
    failedRoutes: PrerenderRoute[];
  }) => HookResult;

  /** @deprecated Use `build:config` (the config is passed as `{ rollup }` or `{ rolldown }`). */
  "rollup:before": (fastnode: Fastnode, config: RollupConfig) => HookResult;
  /** @deprecated Use `build:reload`. */
  "rollup:reload": () => HookResult;
}
