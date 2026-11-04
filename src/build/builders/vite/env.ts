import type { EnvironmentOptions, RollupCommonJSOptions, Plugin as VitePlugin } from "vite";
import type { FastnodePluginContext, ViteServiceConfig } from "./types.ts";

import type { RunnerName } from "env-runner";
import { RunnerManager, loadRunner } from "env-runner";
import { join, resolve } from "node:path";
import { runtimeDependencies, runtimeDir } from "#fastnode/meta";
import { resolveModulePath } from "exsolve";
import { isAbsolute } from "pathe";
import { resolveRunnerDeps } from "../../../dev/runner-deps.ts";
import { OPTIONAL_RUNTIME_DEPS_RE } from "../../plugins/runtime-deps.ts";
import { tsconfigPathsNoExternal } from "../../plugins/tsconfig-paths.ts";
import { shutdownRunner } from "../../../dev/shutdown.ts";
import { writeDevWorkerEntry } from "./_dev-worker.ts";
import { viteImportOptions } from "./_import.ts";

export function createFastnodeEnvironment(ctx: FastnodePluginContext): EnvironmentOptions {
  const isWorkerdRunner = _isWorkerdRunner(ctx);
  return {
    consumer: "server",
    build: {
      rollupOptions: ctx.bundlerConfig!.rollupConfig as any,
      rolldownOptions: ctx.bundlerConfig!.rolldownConfig as any,
      minify: ctx.fastnode!.options.minify,
      emptyOutDir: false,
      sourcemap: ctx.fastnode!.options.sourcemap,
      commonjsOptions: ctx.fastnode!.options.commonJS as RollupCommonJSOptions,
      copyPublicDir: false,
      // Vite drops the assets of server environments, but files referenced with
      // `new URL(..., import.meta.url)` are read at runtime. The others are still
      // dropped by the `fastnode:asset-urls` plugin (see `bundler.ts`)
      emitAssets: ctx.fastnode!.options.node,
    },
    resolve: {
      noExternal: ctx.fastnode!.options.dev
        ? [
            /^fastnode(\/|$)/,
            new RegExp(`^(${runtimeDependencies.join("|")})$`), // virtual resolutions in vite skip plugin hooks
            OPTIONAL_RUNTIME_DEPS_RE, // resolved (and installed) on demand from the project
            ...tsconfigPathsNoExternal(ctx.fastnode!), // packages mapped by tsconfig `paths`
            ...ctx.bundlerConfig!.base.noExternal,
          ]
        : true, // production build is standalone
      conditions: _envConditions(ctx),
      externalConditions: _externalConditions(ctx),
    },
    define: {
      // Workaround for tanstack-start (devtools)
      "process.env.NODE_ENV": JSON.stringify(
        ctx.fastnode!.options.dev ? "development" : "production"
      ),
    },
    // Vitest evaluates modules in its own workers, the default dev environment is enough
    dev: ctx._isVitest
      ? undefined
      : {
          createEnvironment: async (envName, envConfig) => {
            const entry = resolve(runtimeDir, "internal/vite/dev-entry.mjs");
            const { createFetchableDevEnvironment } = await import("./dev.ts");
            const env = await createFetchableDevEnvironment(
              envName,
              envConfig,
              await initEnvRunner(ctx),
              entry,
              {
                workerd: isWorkerdRunner,
                vite: viteImportOptions(ctx.fastnode!),
                onInit: () => (ctx._viteEnvs ??= new Map()).set(envName, entry),
              }
            );
            ctx._transformRequest = (id) => env.transformRequest(id);
            return env;
          },
        },
  };
}

export function createServiceEnvironment(
  ctx: FastnodePluginContext,
  name: string,
  serviceConfig: ViteServiceConfig
): EnvironmentOptions {
  const isDev = ctx.fastnode!.options.dev;
  const isWorkerdRunner = _isWorkerdRunner(ctx);
  return {
    consumer: "server",
    build: {
      rollupOptions: {
        input: { index: serviceConfig.entry },
        ...(isDev ? {} : { external: [/^fastnode(\/|$)/] }),
        output: { minifyInternalExports: false },
      },
      minify: ctx.fastnode!.options.minify,
      sourcemap: ctx.fastnode!.options.sourcemap,
      outDir: join(ctx.fastnode!.options.buildDir, "vite/services", name),
      emptyOutDir: true,
      copyPublicDir: false,
    },
    resolve: {
      ...(isDev ? { noExternal: [/^fastnode(\/|$)/] } : {}),
      conditions: _envConditions(ctx),
      externalConditions: _externalConditions(ctx),
    },
    dev: ctx._isVitest
      ? undefined
      : {
          createEnvironment: async (envName, envConfig) => {
            const entry = tryResolve(serviceConfig.entry);
            const { createFetchableDevEnvironment } = await import("./dev.ts");
            return createFetchableDevEnvironment(
              envName,
              envConfig,
              await initEnvRunner(ctx),
              entry,
              {
                workerd: isWorkerdRunner,
                vite: viteImportOptions(ctx.fastnode!),
                onInit: () => (ctx._viteEnvs ??= new Map()).set(envName, entry),
              }
            );
          },
        },
  };
}

export function createServiceEnvironments(
  ctx: FastnodePluginContext
): Record<string, EnvironmentOptions> {
  return Object.fromEntries(
    Object.entries(ctx.services).map(([name, config]) => [
      name,
      createServiceEnvironment(ctx, name, config),
    ])
  );
}

export async function initEnvRunner(ctx: FastnodePluginContext) {
  if (ctx._envRunner) {
    return ctx._envRunner;
  }
  if (ctx._closingEnvRunner) {
    throw new Error("Fastnode dev env runner is closed.");
  }
  if (!ctx._initPromise) {
    ctx._initPromise = (async () => {
      const manager = new RunnerManager();
      let _retries = 0;
      manager.onClose((_runner, cause) => {
        if (ctx._closingEnvRunner) {
          return;
        }
        if (_retries++ < 3) {
          ctx.fastnode!.logger.info("Restarting env runner...", cause ? `Cause: ${cause}` : "");
          _loadRunner(ctx, manager).catch((error) => ctx.fastnode!.logger.error(error));
        } else {
          ctx.fastnode!.logger.error(
            "Env runner failed after 3 retries.",
            cause ? `Last cause: ${cause}` : ""
          );
        }
      });
      manager.onReady(() => {
        _retries = 0;
        if (ctx._viteEnvs) {
          for (const [name, entry] of ctx._viteEnvs) {
            manager.sendMessage({
              type: "custom",
              event: "fastnode:vite-env",
              data: { name, entry },
            });
          }
        }
      });
      await _loadRunner(ctx, manager);
      ctx._envRunner = manager;
      return manager;
    })();
  }
  return await ctx._initPromise;
}

/**
 * Shut the dev runner down gracefully: the runtime `close` hooks run in the worker before the
 * runtime is terminated (#4586).
 */
export async function closeEnvRunner(ctx: FastnodePluginContext) {
  if (ctx._closingEnvRunner) {
    return;
  }
  ctx._closingEnvRunner = true;
  const manager = ctx._envRunner || (await ctx._initPromise?.catch(() => undefined));
  if (!manager) {
    return;
  }
  // With drain, the manager shuts the active and draining runners down gracefully
  if (ctx.fastnode!.options.devServer.drain) {
    await manager.shutdown();
    return;
  }
  // The miniflare runner runs the same handshake itself when it is disposed, so it is only
  // needed for the runners that terminate their runtime outright.
  if (manager.ready && !_isWorkerdRunner(ctx)) {
    await shutdownRunner(manager, { warn: (message) => ctx.fastnode!.logger.warn(message) });
  }
  await manager.close();
}

export async function reloadEnvRunner(ctx: FastnodePluginContext) {
  const manager = ctx._envRunner;
  if (!manager) {
    return initEnvRunner(ctx);
  }
  await _loadRunner(ctx, manager);
  return manager;
}

async function _loadRunner(ctx: FastnodePluginContext, manager: RunnerManager) {
  const runnerName = _devRunner(ctx);
  const entry = await writeDevWorkerEntry(ctx.fastnode!);
  const runner = await loadRunner(runnerName, {
    ...(await resolveRunnerDeps(ctx.fastnode!, runnerName)),
    name: "fastnode-vite",
    data: { entry },
  });
  await manager.reload(runner, { drain: ctx.fastnode!.options.devServer.drain });
}

// Resolve export conditions for the (non-workerd) environment.
// In dev with the default `node-worker` runner, the module runner executes in a
// worker thread of the same host runtime (Bun => Bun, Deno => Deno), so prepend
// the matching export condition to let packages resolve their runtime-native
// entry instead of the `node` one. Other runners (process-based or miniflare)
// run in a different runtime, so the host condition must not leak into their
// resolution; outside of dev the conditions are returned unchanged.
function _resolveConditions(ctx: FastnodePluginContext): string[] {
  const exportConditions = ctx.fastnode!.options.exportConditions!;
  if (!ctx.fastnode!.options.dev || _devRunner(ctx) !== "node-worker") {
    return exportConditions;
  }
  const runtimeCondition =
    typeof (globalThis as any).Bun !== "undefined"
      ? "bun"
      : typeof (globalThis as any).Deno !== "undefined"
        ? "deno"
        : undefined;
  return runtimeCondition && !exportConditions.includes(runtimeCondition)
    ? [runtimeCondition, ...exportConditions]
    : exportConditions;
}

// Dependencies are not inlined in dev: they are imported by the runtime of the runner (workerd
// loads them, CommonJS included, through the module fallback service of env-runner).
function _envConditions(ctx: FastnodePluginContext): string[] {
  return _isWorkerdRunner(ctx) ? _workerdConditions(ctx) : _resolveConditions(ctx);
}

// The runtime resolves the imports of externalized dependencies itself, without the
// `development`/`production` condition: resolving the app's own imports of them with it
// would load a second copy of a dependency (#4994).
function _externalConditions(ctx: FastnodePluginContext): string[] {
  return _envConditions(ctx).filter(
    (c) => !/browser|wasm|module/.test(c) && c !== "development" && c !== "production"
  );
}

function _workerdConditions(ctx: FastnodePluginContext): string[] {
  const exportConditions = ctx.fastnode!.options.exportConditions!;
  return [...new Set(["workerd", "worker", ...exportConditions.filter((c) => c !== "node")])];
}

function _devRunner(ctx: FastnodePluginContext): RunnerName {
  return (ctx.fastnode!.options.devServer.runner ||
    process.env.FASTNODE_DEV_RUNNER ||
    "node-worker") as RunnerName;
}

export function _isWorkerdRunner(ctx: FastnodePluginContext): boolean {
  return _devRunner(ctx) === "miniflare";
}

function tryResolve(id: string) {
  if (/^[~#/\0]/.test(id) || isAbsolute(id)) {
    return id;
  }
  const resolved = resolveModulePath(id, {
    suffixes: ["", "/index"],
    extensions: ["", ".ts", ".mjs", ".cjs", ".js", ".mts", ".cts"],
    try: true,
  });
  return resolved || id;
}
