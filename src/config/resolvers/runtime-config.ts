import { defu } from "defu";

import type { FastnodeConfig, FastnodeOptions, FastnodeRuntimeConfig } from "fastnode/types";

export async function resolveRuntimeConfigOptions(options: FastnodeOptions) {
  options.runtimeConfig = normalizeRuntimeConfig(options);
}

export function normalizeRuntimeConfig(config: FastnodeConfig) {
  provideFallbackValues(config.runtimeConfig || {});
  const runtimeConfig: FastnodeRuntimeConfig = defu(
    config.runtimeConfig as FastnodeRuntimeConfig,
    {
      app: {
        baseURL: config.baseURL,
      },
      fastnode: {
        envExpansion: config.experimental?.envExpansion,
        openAPI: config.openAPI,
      },
    } as FastnodeRuntimeConfig
  );
  runtimeConfig.fastnode ??= {};
  runtimeConfig.fastnode.routeRules = config.routeRules;
  checkSerializableRuntimeConfig(runtimeConfig);
  return runtimeConfig as FastnodeRuntimeConfig;
}

function provideFallbackValues(obj: Record<string, any>) {
  for (const key in obj) {
    if (obj[key] === undefined || obj[key] === null) {
      obj[key] = "";
    } else if (typeof obj[key] === "object") {
      provideFallbackValues(obj[key]);
    }
  }
}

function checkSerializableRuntimeConfig(obj: any, path: string[] = []) {
  if (isPrimitiveValue(obj)) {
    return;
  }

  for (const key in obj) {
    const value = obj[key];
    if (value === null || value === undefined || isPrimitiveValue(value)) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const [index, item] of value.entries())
        checkSerializableRuntimeConfig(item, [...path, `${key}[${index}]`]);
    } else if (
      typeof value === "object" &&
      value.constructor === Object &&
      (!value.constructor?.name || value.constructor.name === "Object")
    ) {
      checkSerializableRuntimeConfig(value, [...path, key]);
    } else {
      console.warn(
        `Runtime config option \`${[...path, key].join(".")}\` may not be able to be serialized.`
      );
    }
  }
}

function isPrimitiveValue(value: any) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
