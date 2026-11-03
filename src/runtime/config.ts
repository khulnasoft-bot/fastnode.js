import type { FastnodeConfig } from "fastnode/types";

export function defineConfig(
  config: Omit<FastnodeConfig, "rootDir">
): Omit<FastnodeConfig, "rootDir"> {
  return config;
}

/** @deprecated Use `defineConfig` from `fastnode` instead. */
export const defineFastnodeConfig: typeof defineConfig = defineConfig;
