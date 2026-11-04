import { loadConfig, watchConfig } from "c12";
import type { ResolvedConfig } from "c12";
import consola from "consola";
import { createDefu } from "defu";
import { resolveCompatibilityDates } from "compatx";
import type { CompatibilityDateSpec } from "compatx";
import { klona } from "klona/full";
import type { PresetName } from "../presets/index.ts";
import type {
  LoadConfigOptions,
  FastnodeConfig,
  FastnodeConfigLayer,
  FastnodeOptions,
  FastnodePresetMeta,
} from "fastnode/types";

import { FastnodeDefaults } from "./defaults.ts";
import { mergeConfig, mergeConfigHooks } from "./_merge.ts";

// Resolvers
import { resolveAssetsOptions } from "./resolver/assets.ts";
import { resolveCompatibilityOptions } from "./resolver/compatibility.ts";
import { resolveDatabaseOptions } from "./resolver/database.ts";
import { resolveDepsOptions } from "./resolver/deps.ts";
import { resolveExportConditionsOptions } from "./resolver/export-conditions.ts";
import { resolveOpenAPIOptions } from "./resolver/open-api.ts";
import { resolveTsconfig } from "./resolver/tsconfig.ts";
import { resolvePathOptions } from "./resolver/paths.ts";
import { resolveRouteRulesOptions } from "./resolver/route-rules.ts";
import { resolveRuntimeConfigOptions } from "./resolver/runtime-config.ts";
import { resolveKVOptions } from "./resolver/kv.ts";
import { resolveCacheOptions } from "./resolver/cache.ts";
import { resolveURLOptions } from "./resolver/url.ts";
import { resolveErrorOptions } from "./resolver/error.ts";
import { resolveUnenv } from "./resolver/unenv.ts";
import { resolveBuilder } from "./resolver/builder.ts";
import { resolveTracingChannelOptions } from "./resolver/tracing.ts";

const configResolvers = [
  resolveCompatibilityOptions,
  resolveTsconfig,
  resolvePathOptions,
  resolveDepsOptions,
  resolveRouteRulesOptions,
  resolveDatabaseOptions,
  resolveExportConditionsOptions,
  resolveRuntimeConfigOptions,
  resolveOpenAPIOptions,
  resolveURLOptions,
  resolveAssetsOptions,
  resolveKVOptions,
  resolveCacheOptions,
  resolveErrorOptions,
  resolveUnenv,
  resolveBuilder,
  resolveTracingChannelOptions,
] as const;

export async function loadOptions(
  configOverrides: FastnodeConfig = {},
  opts: LoadConfigOptions = {}
): Promise<FastnodeOptions> {
  const options = await _loadUserConfig(configOverrides, opts);
  for (const resolver of configResolvers) {
    await resolver(options);
  }
  return options;
}

async function _loadUserConfig(
  configOverrides: FastnodeConfig = {},
  opts: LoadConfigOptions = {}
): Promise<FastnodeOptions> {
  // Load configuration and preset
  configOverrides = klona(configOverrides);

  // @ts-ignore
  globalThis.defineFastnodeConfig = globalThis.defineFastnodeConfig || ((c) => c);

  // Compatibility date
  let compatibilityDate: CompatibilityDateSpec | undefined =
    configOverrides.compatibilityDate ||
    opts.compatibilityDate ||
    ((process.env.FASTNODE_COMPATIBILITY_DATE ||
      process.env.SERVER_COMPATIBILITY_DATE ||
      process.env.COMPATIBILITY_DATE) as CompatibilityDateSpec);

  // Preset resolver
  const { resolvePreset } = await import("../presets/index.ts");

  // prettier-ignore
  let preset: string | undefined = (configOverrides.preset as string) || process.env.FASTNODE_PRESET || process.env.SERVER_PRESET;

  // Inline `defaultPreset` object resolved during auto-detection (injected via `resolve`)
  let inlineDefaultPreset: (FastnodeConfig & { _meta?: FastnodePresetMeta }) | undefined;

  const _dotenv = opts.dotenv ?? { fileName: [".env", ".env.local"] };
  const envName =
    opts.c12?.envName ??
    (configOverrides.dev
      ? "development"
      : configOverrides.preset === "fastnode-prerender"
        ? ["production", "prerender"]
        : "production");
  const loadedConfig = await (
    opts.watch
      ? watchConfig<FastnodeConfig & { _meta?: FastnodePresetMeta }>
      : loadConfig<FastnodeConfig & { _meta?: FastnodePresetMeta }>
  )({
    name: "fastnode",
    cwd: configOverrides.rootDir,
    dotenv: _dotenv,
    extend: { extendKey: ["extends", "preset"] },
    defaults: FastnodeDefaults,
    merger: mergeConfig,
    envMerger: mergeEnvConfig,
    async overrides({ rawConfigs }) {
      // prettier-ignore
      const getConf = <K extends keyof FastnodeConfig>(key: K) => (configOverrides[key] ?? (rawConfigs.main as FastnodeConfig)?.[key] ?? (rawConfigs.rc as FastnodeConfig)?.[key] ?? (rawConfigs.packageJson as FastnodeConfig)?.[key]) as FastnodeConfig[K];

      if (!compatibilityDate) {
        compatibilityDate = getConf("compatibilityDate");
      }

      if (!preset) {
        preset = getConf("preset");
      }

      if (configOverrides.dev) {
        // Check if preset has compatible dev support
        // Otherwise use default fastnode-dev preset
        preset =
          preset && preset !== "fastnode-dev"
            ? await resolvePreset(preset, {
                static: getConf("static"),
                dev: true,
                compatibilityDate: compatibilityDate || "latest",
              })
                .then((p) => p?._meta?.name || "fastnode-dev")
                .catch(() => "fastnode-dev")
            : "fastnode-dev";
      } else if (!preset) {
        // Auto detect production preset (with user-defined `defaultPreset` fallback)
        const defaultPreset = getConf("defaultPreset");
        const resolved = await resolvePreset("" /* auto detect */, {
          static: getConf("static"),
          dev: false,
          compatibilityDate: compatibilityDate || "latest",
          defaultPreset,
        });
        preset = resolved?._meta?.name;
        // An inline `defaultPreset` object has no resolvable name, inject it directly
        if (resolved && defaultPreset && typeof defaultPreset !== "string") {
          inlineDefaultPreset = resolved;
        }
      }

      return {
        ...configOverrides,
        preset,
      };
    },
    async resolve(id: string) {
      if (inlineDefaultPreset && id === inlineDefaultPreset._meta?.name) {
        return { config: klona(inlineDefaultPreset) };
      }
      const preset = await resolvePreset(id, {
        static: configOverrides.static,
        compatibilityDate: compatibilityDate || "latest",
        dev: configOverrides.dev,
      });
      if (preset) {
        return {
          config: klona(preset),
        };
      }
      return undefined;
    },
    ...opts.c12,
    envName,
  });

  const options = klona(loadedConfig.config) as FastnodeOptions;

  options._config = configOverrides;
  options._c12 = loadedConfig;
  options.layers = resolveLayers(loadedConfig);
  // Exposed as `import.meta.envName` (the first name of a list, such as `["production", "prerender"]`)
  options.envName =
    (Array.isArray(envName) ? envName.find(Boolean) : envName) ||
    (options.dev ? "development" : "production");

  const _presetName =
    (loadedConfig.layers || []).find((l) => l.config?._meta?.name)?.config?._meta?.name || preset;
  options.preset = _presetName as PresetName;

  options.compatibilityDate = resolveCompatibilityDates(
    compatibilityDate,
    options.compatibilityDate
  );

  if (options.dev && options.preset !== "fastnode-dev") {
    consola.info(`Using \`${options.preset}\` emulation in development mode.`);
  }

  return options;
}

const kvConfigKeys = new Set(["kv", "storage", "devStorage"]);

// Env mounts (e.g. from `$development`) with a different driver replace the whole mount instead of deep merging options
const mergeEnvConfig = createDefu((obj, key, value, namespace) => {
  if (mergeConfigHooks(obj, key, value, namespace)) {
    return true;
  }
  const current = obj[key] as { driver?: unknown } | undefined;
  if (
    kvConfigKeys.has(namespace) &&
    value?.driver &&
    current?.driver &&
    value.driver !== current.driver
  ) {
    obj[key] = value;
    return true;
  }
  return false;
}) as (...sources: any[]) => any;

// c12 layers also include overrides, rc, package.json and preset layers, which have no `cwd`
function resolveLayers(c12: ResolvedConfig<FastnodeConfig>): FastnodeConfigLayer[] {
  const c12Layers = c12.layers || [];
  const rootLayer = c12Layers.find((layer) => layer.cwd && !layer.source);
  return [
    {
      cwd: c12.cwd!,
      configFile: c12._configFile,
      config: rootLayer?.config || {},
      meta: c12.meta,
    },
    ...c12Layers
      .filter((layer) => layer.cwd && layer.source)
      .map((layer) => ({
        cwd: layer.cwd!,
        configFile: layer.configFile,
        config: layer.config || {},
        meta: layer.meta,
      })),
  ];
}
