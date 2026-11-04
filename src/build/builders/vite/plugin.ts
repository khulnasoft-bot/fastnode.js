import type {
  Alias,
  AliasOptions,
  ConfigEnv,
  EnvironmentModuleNode,
  EnvironmentOptions,
  PluginOption,
  UserConfig,
  Plugin as VitePlugin,
} from "vite";
import type { InputOption } from "rollup";
import type { FastnodePluginConfig, FastnodePluginContext } from "./types.ts";
import { resolve, join } from "pathe";
import { normalizeAliases, resolveAlias } from "pathe/utils";
import { createFastnode, prepare } from "../../../builder.ts";
import { installModules } from "../../../core/application/module.ts";
import { getBundlerConfig } from "./bundler.ts";
import { buildEnvironments } from "./prod.ts";
import {
  initEnvRunner,
  closeEnvRunner,
  createFastnodeEnvironment,
  createServiceEnvironments,
  createServiceEnvironment,
} from "./env.ts";
import { runtimeDir } from "#fastnode/meta";
import { resolveModulePath } from "exsolve";
import { mergeConfig } from "../../../config/_merge.ts";
import { prettyPath } from "../../../utils/fs.ts";
import { escapeRegExp } from "../../../utils/regex.ts";
import { FastnodeDevApp } from "../../../dev/app.ts";
import { fastnodePreviewPlugin } from "./preview.ts";
import { fastnodeAssetsImport } from "./_assets.ts";
import { defu } from "defu";
import type { Fastnode, FastnodeConfig, FastnodeModule } from "fastnode/types";
import {
  fastnodeDevServiceProxy,
  SERVICE_MANIFEST_FILE,
  viteServicesTemplate,
} from "./services.ts";
import { fastnodeRequireExternals } from "./_require-externals.ts";
import { fastnodeServerAliases } from "./_server-aliases.ts";
import { importVite, setRunningVite, viteImportOptions } from "./_import.ts";
import { isVitest, fastnodeVitest } from "./vitest.ts";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

const DEFAULT_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".tsx", ".jsx"];

const debug = process.env.FASTNODE_DEBUG
  ? (...args: any[]) => console.log("[fastnode]", ...args)
  : () => {};

export function fastnode(pluginConfig: FastnodePluginConfig = {}): VitePlugin[] {
  if ((globalThis as any).__fastnode_build__) {
    // We are in `fastnode build` context. Fastnode injects vite plugin itself
    return [];
  }
  const ctx: FastnodePluginContext = createContext(pluginConfig);
  return [
    fastnodeInit(ctx),
    fastnodeEnv(ctx),
    fastnodeServerAliases(ctx),
    fastnodeMain(ctx),
    fastnodePrepare(ctx),
    fastnodeDevServiceProxy(ctx),
    fastnodeRequireExternals(),
    fastnodePreviewPlugin(ctx),
    fastnodeVitest(ctx),
    ...fastnodeAssetsImport(ctx),
  ];
}

function fastnodeInit(ctx: FastnodePluginContext): VitePlugin {
  return {
    name: "fastnode:init",
    sharedDuringBuild: true,
    apply: (_config, configEnv) => !configEnv.isPreview,

    async config(config, configEnv) {
      ctx._isRolldown = !!(this.meta as Record<string, string>).rolldownVersion;
      if (!ctx._initialized) {
        debug("[init] Initializing fastnode");
        ctx._initialized = true;
        ctx._isVitest = isVitest(config);
        await setupFastnodeContext(ctx, configEnv, config);
      }
    },

    async configResolved(config) {
      setRunningVite(useFastnode(ctx), config);
      // Inline plugins are reused on `server.restart()`
      if (config.command === "serve" && !ctx._viteVersionChecked) {
        ctx._viteVersionChecked = true;
        await checkViteVersion(ctx, this.meta.viteVersion);
      }
      // Vite resolves its plugin list *before* running config hooks, so a plugin added by
      // another plugin's `config` hook is discovered by Fastnode but silently ignored by Vite.
      for (const plugin of ctx._pluginModules || []) {
        if (!config.plugins.some((p) => p === plugin || p.fastnode === plugin.fastnode)) {
          useFastnode(ctx).logger.warn(
            `Vite plugin \`${plugin.name}\` registers a Fastnode module but is not applied by Vite. ` +
              `Plugins added from a \`config\` hook are ignored by Vite; add it to \`plugins\` instead.`
          );
        }
      }
    },

    applyToEnvironment(env) {
      if (env.name !== "fastnode") {
        return;
      }
      const plugins: VitePlugin[] = [];
      if (ctx._fastnodeEnvAliases?.length) {
        plugins.push(fastnodeEnvAliases(ctx.bundlerConfig!.base.aliases, ctx._fastnodeEnvAliases));
      }
      if (ctx.fastnode?.options.dev) {
        debug("[init] Adding rollup plugins for dev");
        plugins.push(
          ...((ctx.bundlerConfig?.rolldownConfig?.plugins as VitePlugin[]) ||
            (ctx.bundlerConfig?.rollupConfig?.plugins as VitePlugin[]) ||
            [])
        );
      }
      if (plugins.length > 0) {
        return plugins;
      }
      return plugins;
    },
  };
}

function fastnodeEnv(ctx: FastnodePluginContext): VitePlugin {
  return {
    name: "fastnode:env",
    sharedDuringBuild: true,
    apply: (_config, configEnv) => !configEnv.isPreview,

    async config(userConfig, _configEnv) {
      debug("[env]  Extending config (environments)");
      const environments: Record<string, EnvironmentOptions> = {
        ...createServiceEnvironments(ctx),
        fastnode: createFastnodeEnvironment(ctx),
      };
      environments.client = {
        consumer: userConfig.environments?.client?.consumer ?? "client",
        build: {
          rollupOptions: {
            input:
              userConfig.environments?.client?.build?.rollupOptions?.input ??
              useFastnode(ctx).options.renderer?.template,
          },
        },
      };
      debug("[env]  Environments:", Object.keys(environments).join(", "));
      return {
        environments,
      };
    },

    configEnvironment(name, config) {
      if (config.consumer === "client") {
        debug("[env]  Configuring client environment", name === "client" ? "" : ` (${name})`);
        const fastnode = useFastnode(ctx);
        config.build!.emptyOutDir = false;
        config.build!.outDir = fastnode.options.output.publicDir;
        config.build!.copyPublicDir ??= false;
        // Relocate generated client assets (e.g. under `_vercel/immutable`) so
        // both client and SSR references point at the immutable base.
        if (fastnode.options.buildAssetsDir) {
          config.build!.assetsDir = fastnode.options.buildAssetsDir;
          // Content-addressed (immutable) assets benefit from longer content
          // hashes to reduce collision risk across deployments. Only upgrade the
          // default `[hash]` token to a longer one; never override filename
          // patterns explicitly set by the user or other plugins.
          useLongerAssetHashes(config.build!, ctx._isRolldown, fastnode.options.buildAssetsDir);
        }
        return;
      }

      // Server environments render public asset URLs (`?url` imports, font CSS)
      // derived from their `assetsDir`, so it must point at the immutable base
      // where the client build actually emits the files. Only asset naming is
      // aligned (`assetsOnly`): entry/chunk filenames are left at their defaults
      // so each service keeps a flat entry that frameworks import by path.
      const fastnode = useFastnode(ctx);
      if (name !== "fastnode" && fastnode.options.buildAssetsDir) {
        config.build!.assetsDir = fastnode.options.buildAssetsDir;
        useLongerAssetHashes(config.build!, ctx._isRolldown, fastnode.options.buildAssetsDir, {
          assetsOnly: true,
        });
      }

      // Skip if already registered as a service
      if (name === "fastnode" || ctx.services[name]) {
        return;
      }

      // Auto-register server consumer environments as services
      const entry = getEntry(
        config.build?.rolldownOptions?.input || config.build?.rollupOptions?.input
      );
      if (typeof entry !== "string") {
        return;
      }

      // Resolve and register as a service
      const resolvedEntry =
        resolveModulePath(entry, {
          from: [ctx.fastnode!.options.rootDir, ...ctx.fastnode!.options.scanDirs],
          extensions: DEFAULT_EXTENSIONS,
          suffixes: ["", "/index"],
          try: true,
        }) || entry;

      ctx.services[name] = { entry: resolvedEntry };
      debug(`[env]  Auto-detected service "${name}" with entry: ${resolvedEntry}`);

      // Return service environment configuration to merge
      return createServiceEnvironment(ctx, name, { entry: resolvedEntry });
    },

    configResolved() {
      // Setup default SSR renderer after all environments are configured
      if (
        !ctx.fastnode!.options.renderer?.handler &&
        !ctx.fastnode!.options.renderer?.template &&
        ctx.services.ssr?.entry
      ) {
        ctx.fastnode!.options.renderer ??= {};
        ctx.fastnode!.options.renderer.handler = resolve(runtimeDir, "internal/vite/ssr-renderer");
        ctx.fastnode!.routing.sync();
      }
    },
  };
}

function fastnodeEnvAliases(_aliases: Record<string, string>, keys: string[]): VitePlugin {
  const aliases = normalizeAliases(_aliases);
  const keysRE = keys.map((key) => escapeRegExp(key.replace(/\/$/, ""))).join("|");
  return {
    name: "fastnode:env-aliases",
    resolveId: {
      order: "pre",
      filter: { id: new RegExp(`^(?:${keysRE})(?:/|$)`) },
      async handler(id, importer, options) {
        const resolved = resolveAlias(id, aliases);
        if (resolved !== id) {
          return (
            (await this.resolve(resolved, importer, { ...options, skipSelf: true })) || resolved
          );
        }
        return undefined;
      },
    },
  };
}

function fastnodeMain(ctx: FastnodePluginContext): VitePlugin {
  return {
    name: "fastnode:main",
    sharedDuringBuild: true,
    apply: (_config, configEnv) => !configEnv.isPreview,

    async config(userConfig, _configEnv) {
      debug("[main] Extending config (appType, resolve, server)");
      if (!ctx.bundlerConfig) {
        throw new Error("Bundler config is not initialized yet!");
      }
      // Keep alias order and never leak `node:` builtins to client builds
      const aliases = Object.entries(ctx.bundlerConfig.base.aliases).filter(
        ([, replacement]) => !replacement.startsWith("node:")
      );
      // Scoped to the `fastnode` environment (not with Vitest): `fastnode/*` in dev, so
      // they do not bypass the dev service proxy, and keys the host config maps elsewhere
      const scopeSelfAliases = ctx.fastnode?.options.dev && !ctx._isVitest;
      const hostAliases = ctx._isVitest ? new Map() : stringAliases(userConfig.resolve?.alias);
      const isScoped = ([find, replacement]: [string, string]) =>
        (scopeSelfAliases && /^fastnode(\/|$)/.test(find)) ||
        (hostAliases.has(find) && hostAliases.get(find) !== replacement);
      ctx._fastnodeEnvAliases = aliases.filter(isScoped).map(([find]) => find);
      return {
        appType: userConfig.appType || "custom",
        resolve: {
          alias: aliases
            .filter((alias) => !isScoped(alias))
            .map(([find, replacement]) => ({
              find,
              replacement,
            })),
        },
        builder: {
          sharedConfigBuild: true,
        },
        server: {
          port:
            Number.parseInt(process.env.PORT || "") ||
            userConfig.server?.port ||
            useFastnode(ctx).options.devServer?.port ||
            3000,
          // #3673, disable Vite's `cors` by default as Fastnode handles all requests
          cors: false,
        },
      };
    },

    configResolved(config) {
      if (ctx._isVitest) {
        return;
      }
      // Aliases added by later `config` hooks take precedence over Fastnode's
      const fastnodeAliases = ctx.bundlerConfig!.base.aliases;
      const scoped = new Set(ctx._fastnodeEnvAliases);
      for (const { find, replacement } of config.resolve.alias) {
        if (
          typeof find === "string" &&
          Object.hasOwn(fastnodeAliases, find) &&
          fastnodeAliases[find] !== replacement &&
          !fastnodeAliases[find]!.startsWith("node:")
        ) {
          scoped.add(find);
        }
      }
      ctx._fastnodeEnvAliases = [...scoped];
    },

    buildApp: {
      order: "post",
      handler(builder) {
        debug("[main] Building environments");
        return buildEnvironments(ctx, builder);
      },
    },

    generateBundle: {
      handler(_options, bundle) {
        const environment = this.environment;
        debug("[main] Generating manifest and entry points for environment:", environment.name);
        const serviceNames = Object.keys(ctx.services);
        const isRegisteredService = serviceNames.includes(environment.name);

        // Find entry point of this service
        let entryFile: string | undefined;
        const serviceEntry =
          isRegisteredService && ctx.services[environment.name]?.entry
            ? resolve(ctx.services[environment.name]!.entry)
            : undefined;
        for (const [_name, file] of Object.entries(bundle)) {
          if (file.type === "chunk" && isRegisteredService && file.isEntry) {
            if (
              serviceEntry &&
              file.facadeModuleId &&
              resolve(file.facadeModuleId) === serviceEntry
            ) {
              entryFile = file.fileName;
              break;
            }
            // Fallback: use first entry chunk if no facadeModuleId match
            if (entryFile === undefined) {
              entryFile = file.fileName;
            }
          }
        }
        if (isRegisteredService) {
          if (entryFile === undefined) {
            this.error(`No entry point found for service "${this.environment.name}".`);
          }
          ctx._entryPoints![this.environment.name] = entryFile!;
          this.emitFile({
            type: "asset",
            fileName: SERVICE_MANIFEST_FILE,
            source: JSON.stringify({ entry: entryFile }),
          });
        }
      },
    },

    configureServer: async (server) => {
      if (ctx._isVitest) {
        return;
      }
      debug("[main] Configuring dev server");
      const { configureViteDevServer } = await import("./dev.ts");
      return configureViteDevServer(ctx, server);
    },

    // Closing the dev server closes every environment, and each of them runs `closeBundle`.
    // Fastnode is shared by all of them, so its `close` hooks run once (#4586). The production
    // build closes Fastnode itself (see `prod.ts`).
    closeBundle: {
      order: "post",
      handler() {
        if (!ctx.fastnode?.options.dev) {
          return;
        }
        return (ctx._closePromise ??= ctx.fastnode.close());
      },
    },

    // Invalidate server-only modules and optionally reload the browser
    // see: https://github.com/vitejs/vite/issues/19114
    async hotUpdate({ server, file, modules, timestamp }) {
      const env = this.environment;
      if (env.config.consumer === "client" || ctx._isVitest) {
        return;
      }
      if (ctx.fastnode?.options.vite?.serverReload === false) {
        // Keep the server module graph in sync but opt out of the reload:
        // returning an empty list also suppresses Vite's own `full-reload`,
        // which would otherwise still reach (and reload) the dev worker.
        const invalidated = new Set<EnvironmentModuleNode>();
        for (const mod of modules) {
          env.moduleGraph.invalidateModule(mod, invalidated, timestamp, false);
        }
        return [];
      }
      // Server-only changes send nothing to the browser, so tell open dev error pages to retry.
      if (modules.length > 0) {
        ctx.devApp?.reloadSignal.bump();
      }
      const clientEnvs = Object.values(server.environments).filter(
        (env) => env.config.consumer === "client"
      );
      const serverOnlyModules: EnvironmentModuleNode[] = [];
      const sharedModules: EnvironmentModuleNode[] = [];
      const invalidated = new Set<EnvironmentModuleNode>();
      for (const mod of modules) {
        if (mod.id && !clientEnvs.some((env) => env.moduleGraph.getModuleById(mod.id!))) {
          serverOnlyModules.push(mod);
          env.moduleGraph.invalidateModule(mod, invalidated, timestamp, false);
        } else {
          sharedModules.push(mod);
        }
      }
      if (serverOnlyModules.length > 0) {
        env.hot.send({ type: "full-reload", triggeredBy: file });
        if (sharedModules.length === 0 && serverOnlyModules.some((m) => m.environment !== "ssr")) {
          server.ws.send({ type: "full-reload" });
        }
        return sharedModules;
      }
      return [];
    },
  };
}

function fastnodePrepare(ctx: FastnodePluginContext): VitePlugin {
  return {
    name: "fastnode:prepare",
    sharedDuringBuild: true,
    applyToEnvironment: (env) => env.name === "fastnode",

    buildApp: {
      // Clean the output directory before any environment is built
      order: "pre",
      async handler() {
        debug("[prepare] Preparing output directory");
        const fastnode = ctx.fastnode!;
        await prepare(fastnode, {
          generatedAssetDirs: ctx._publicDistDir ? [ctx._publicDistDir] : [],
        });
      },
    },
  };
}

// --- internal helpers ---

function createContext(pluginConfig: FastnodePluginConfig): FastnodePluginContext {
  return {
    pluginConfig,
    services: {},
    _entryPoints: {},
  };
}

/**
 * The dev environments and module runner are created from the `vite` Fastnode imports, which has
 * to be the one running the dev server (in a monorepo, another version can be hoisted next to
 * the app).
 */
async function checkViteVersion(ctx: FastnodePluginContext, runningVersion?: string) {
  const fastnode = useFastnode(ctx);
  const { version } = await importVite(viteImportOptions(fastnode));
  if (runningVersion && version !== runningVersion) {
    fastnode.logger.warn(
      `Fastnode resolved \`vite@${version}\` but \`vite@${runningVersion}\` is running. ` +
        `Set the \`vite.path\` option to the running \`vite\` package (e.g. \`import.meta.resolve("vite")\`).`
    );
  }
}

function useFastnode(ctx: FastnodePluginContext) {
  if (!ctx.fastnode) {
    throw new Error("Fastnode instance is not initialized yet.");
  }
  return ctx.fastnode;
}

async function setupFastnodeContext(
  ctx: FastnodePluginContext,
  configEnv: ConfigEnv,
  userConfig: UserConfig
) {
  // When using `fastnode build`, a pre-initialized fastnode instance is provided
  const providedFastnode = ctx.pluginConfig._fastnode;

  // Fastnode config overrides
  const fastnodeConfig: FastnodeConfig = {
    dev: configEnv.command === "serve",
    builder: "vite",
    rootDir: userConfig.root,
    ...mergeConfig(ctx.pluginConfig, userConfig.fastnode),
  };

  // Register Fastnode modules from Vite plugins
  ctx._pluginModules = (await flattenPlugins(userConfig, configEnv)).filter((p) => p.fastnode);
  const pluginModules = ctx._pluginModules.map((p) => p.fastnode!);
  fastnodeConfig.modules = [...(fastnodeConfig.modules || []), ...pluginModules];

  // Register service entries VFS
  const vServicesId = "#fastnode/virtual/vite-services";
  fastnodeConfig.virtual ??= {};
  fastnodeConfig.virtual[vServicesId] = () => viteServicesTemplate(ctx);
  if (providedFastnode) {
    providedFastnode.options.virtual[vServicesId] = fastnodeConfig.virtual[vServicesId];
    applyInlineViteOptions(providedFastnode, fastnodeConfig);
  }

  // @see https://vite.dev/guide/env-and-mode#env-files
  const dotenvFileNames = [".env", ".env.local"];
  if (configEnv.mode) {
    dotenvFileNames.push(`.env.${configEnv.mode}`, `.env.${configEnv.mode}.local`);
  }

  // Initialize a new Fastnode instance
  ctx.fastnode =
    providedFastnode ||
    (await createFastnode(fastnodeConfig, { dotenv: { fileName: dotenvFileNames } }));

  // Install Vite plugin modules on the provided instance (`fastnode build`)
  if (providedFastnode && pluginModules.length > 0) {
    providedFastnode.options.modules = fastnodeConfig.modules;
    await installModules(providedFastnode, pluginModules);
  }

  // Register services from config
  ctx.services = { ...ctx.fastnode.options.vite?.services };

  // Config ssr env as a fetchable ssr service
  if (!ctx.services.ssr) {
    const userSsrEnv = userConfig.environments?.ssr;
    // Vitest always defines an `ssr` environment (without an entry) for its own use
    const userSsrInput =
      userSsrEnv?.build?.rolldownOptions?.input ?? userSsrEnv?.build?.rollupOptions?.input;
    if (userSsrEnv === undefined || (ctx._isVitest && !userSsrInput)) {
      const ssrEntry = resolveModulePath("./entry-server", {
        from: ["app", "src", ""].flatMap((d) =>
          [ctx.fastnode!.options.rootDir, ...ctx.fastnode!.options.scanDirs].map(
            (s) => join(s, d) + "/"
          )
        ),
        extensions: DEFAULT_EXTENSIONS,
        try: true,
      });
      if (ssrEntry) {
        ctx.services.ssr = { entry: ssrEntry };
        ctx.fastnode!.logger.info(`Using \`${prettyPath(ssrEntry)}\` as vite ssr entry.`);
      }
    } else {
      let ssrEntry = getEntry(userSsrInput);
      if (typeof ssrEntry === "string") {
        ssrEntry =
          resolveModulePath(ssrEntry, {
            from: [ctx.fastnode.options.rootDir, ...ctx.fastnode.options.scanDirs],
            extensions: DEFAULT_EXTENSIONS,
            suffixes: ["", "/index"],
            try: true,
          }) || ssrEntry;
        ctx.services.ssr = { entry: ssrEntry };
      }
    }
  }
  if (
    ctx.fastnode.options.serverEntry &&
    ctx.fastnode.options.serverEntry.handler === ctx.services.ssr?.entry
  ) {
    ctx.fastnode.logger.warn(
      `Fastnode server entry and Vite SSR both set to ${prettyPath(ctx.services.ssr.entry)}. Use a separate SSR entry (e.g. \`src/server.ts\`).`
    );
    ctx.fastnode.options.serverEntry = false;
  }

  // Determine default Vite dist directory
  const publicDistDir = (ctx._publicDistDir =
    userConfig.build?.outDir || resolve(ctx.fastnode.options.buildDir, "vite/public"));
  ctx.fastnode.options.publicAssets.push({
    dir: publicDistDir,
    maxAge: 0,
    baseURL: "/",
    fallthrough: true,
  });

  // Vitest runs test files in its own Node.js workers, so hooks must not set up another runner
  if (ctx._isVitest) {
    ctx.fastnode.options.devServer.runner = "node-worker";
  }

  // Call build:before hook **before resolving rollup config** for compatibility
  await ctx.fastnode.hooks.callHook("build:before", ctx.fastnode);

  // Resolve common rollup options
  ctx.bundlerConfig = await getBundlerConfig(ctx);

  // Call build:config hook to allow modifying the bundler config
  await ctx.fastnode.hooks.callHook(
    "build:config",
    ctx.fastnode,
    ctx.bundlerConfig.rollupConfig
      ? { builder: "vite", rollup: ctx.bundlerConfig.rollupConfig }
      : { builder: "vite", rolldown: ctx.bundlerConfig.rolldownConfig! }
  );

  // Attach fastnode.fetch to the dev env runner (started lazily, not when resolving config)
  if (ctx.fastnode.options.dev && !ctx._isVitest) {
    ctx.fastnode.fetch = async (req) => (await initEnvRunner(ctx)).fetch(req);
  }

  // Create dev app
  if (ctx.fastnode.options.dev && !ctx._isVitest && !ctx.devApp) {
    ctx.devApp = new FastnodeDevApp(ctx.fastnode);
  }

  // Cleanup resources after close {
  ctx.fastnode.hooks.hook("close", async () => {
    await closeEnvRunner(ctx);
  });
}

// Upgrade the default `[hash]` filename token to a longer content hash for a
// build environment's output. Filename patterns already configured (by the user
// or other plugins) are only touched to lengthen a bare `[hash]`; explicit
// `[hash:n]` tokens and non-string patterns are left untouched.
//
// Applied to the client environment (all output) and the SSR service
// environment (`assetsOnly` — just `assetFileNames`) so a shared asset
// resolves to the same filename on both sides. The SSR bundle's own
// entry/chunks keep Vite's flat server layout. A user/framework that
// overrides `assetFileNames` is responsible for keeping the two in sync
// (and such assets opt out of the `buildAssetsDir` immutable base).
export function useLongerAssetHashes(
  build: NonNullable<EnvironmentOptions["build"]>,
  isRolldown: boolean | undefined,
  assetsDir: string,
  opts?: { assetsOnly?: boolean }
): void {
  const options = ((build as any)[isRolldown ? "rolldownOptions" : "rollupOptions"] ??= {});
  const outputs = Array.isArray(options.output) ? options.output : [(options.output ??= {})];
  const defaults: Record<string, string> = {
    ...(opts?.assetsOnly
      ? {}
      : {
          entryFileNames: `${assetsDir}/[name]-[hash:16].js`,
          chunkFileNames: `${assetsDir}/[name]-[hash:16].js`,
        }),
    assetFileNames: `${assetsDir}/[name]-[hash:16][extname]`,
  };
  for (const output of outputs) {
    for (const key of Object.keys(defaults)) {
      const current = output[key];
      if (current === undefined) {
        // Not set: opt into a longer-hash default matching Vite's own pattern.
        output[key] = defaults[key];
      } else if (typeof current === "string" && current.includes("[hash]")) {
        // Already set: only lengthen a bare `[hash]` token, keep the rest as-is.
        output[key] = current.replaceAll("[hash]", `[hash:16]`);
      }
    }
  }
}

function stringAliases(alias: AliasOptions | undefined): Map<string, string> {
  const entries = Array.isArray(alias)
    ? (alias as Alias[]).map((a) => [a.find, a.replacement] as const)
    : Object.entries(alias || {});
  return new Map(
    entries.filter((entry): entry is [string, string] => typeof entry[0] === "string")
  );
}

function getEntry(input: InputOption | undefined): string | undefined {
  if (typeof input === "string") {
    return input;
  } else if (Array.isArray(input) && input.length > 0) {
    return input[0];
  } else if (input && "index" in input) {
    return input.index as string;
  }
  return undefined;
}

// Flatten and filter user plugins with the same semantics Vite uses to resolve them.
// (Vite filters by `apply` before calling config hooks but keeps `config.plugins` unfiltered)
// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/config.ts
async function flattenPlugins(userConfig: UserConfig, configEnv: ConfigEnv): Promise<VitePlugin[]> {
  const flat = async (plugins: PluginOption[]): Promise<VitePlugin[]> => {
    const resolved = await Promise.all(plugins);
    const result: VitePlugin[] = [];
    for (const plugin of resolved) {
      if (!plugin) {
        continue;
      }
      if (Array.isArray(plugin)) {
        result.push(...(await flat(plugin)));
      } else {
        result.push(plugin as VitePlugin);
      }
    }
    return result;
  };

  const plugins = await flat(userConfig.plugins || []);

  return plugins.filter((plugin) => {
    if (!plugin.apply) {
      return true;
    }
    return typeof plugin.apply === "function"
      ? plugin.apply({ ...userConfig, mode: configEnv.mode }, configEnv)
      : plugin.apply === configEnv.command;
  });
}

function applyInlineViteOptions(fastnode: Fastnode, fastnodeConfig: FastnodeConfig) {
  if (fastnodeConfig.vite) {
    fastnode.options.vite = defu(fastnodeConfig.vite, fastnode.options.vite);
  }
}
