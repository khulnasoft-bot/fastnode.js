import type { UserConfig, Plugin as VitePlugin } from "vite";
import type { FastnodePluginContext } from "./types.ts";
import { resolve } from "pathe";
import { runtimeDir } from "#fastnode/meta";
import { setupVitestWatch } from "./_vitest-watch.ts";

// https://vitest.dev/guide/environment#custom-environment

/**
 * Vitest creates its internal `__vitest__` environment before any plugin `config` hook runs.
 */
export function isVitest(config: UserConfig): boolean {
  return !!config.environments?.__vitest__;
}

/**
 * Runs Vitest test files in the `fastnode` Vite environment by default, so they resolve `fastnode/*`
 * runtime imports, virtual modules and aliases the same way server code does.
 *
 * The environment is set by path, since Vitest resolves named environments as packages before
 * loading the config plugins. `// @vitest-environment fastnode` resolves through `resolveId`.
 */
export function fastnodeVitest(ctx: FastnodePluginContext): VitePlugin {
  const envPath = resolve(runtimeDir, "internal/vite/vitest-env.mjs");
  const setupPath = resolve(runtimeDir, "internal/vite/vitest-setup.mjs");
  return {
    name: "fastnode:vitest",
    apply: (_config, configEnv) => configEnv.command === "serve",

    config(userConfig) {
      if (!isVitest(userConfig)) {
        return;
      }
      const { environment, pool } =
        (userConfig as { test?: { environment?: string; pool?: string } }).test || {};
      // vm pools only run environments that provide `setupVM`
      const isVmPool = pool === "vmThreads" || pool === "vmForks";
      return {
        test: {
          environment:
            environment === "fastnode" || (!environment && !isVmPool) ? envPath : environment,
          setupFiles: [setupPath],
        },
      } as UserConfig;
    },

    configureVitest(context) {
      // Inline projects resolve from the `test` config captured before the `config` hook
      const { setupFiles } = context.project.config;
      if (!setupFiles.includes(setupPath)) {
        setupFiles.push(setupPath);
      }
      // Virtual modules change on handler rescans without a file change, so the fs module cache
      // (keyed in memory by id until a file is invalidated) would keep serving stale code
      context.defineCacheKeyGenerator?.(({ id }) =>
        id.startsWith("#fastnode/virtual/") ? false : undefined
      );
      setupVitestWatch(ctx, context);
    },

    // Setup files run in every test environment, but only the fastnode one has an app
    load: {
      filter: { id: /vitest-setup\.mjs$/ },
      handler(id) {
        if (id === setupPath && this.environment.name !== "fastnode") {
          return "export {};";
        }
        return undefined;
      },
    },

    resolveId: {
      filter: { id: /^vitest-environment-fastnode$/ },
      handler(id) {
        if (id === "vitest-environment-fastnode") {
          return envPath;
        }
        return undefined;
      },
    },
  };
}
