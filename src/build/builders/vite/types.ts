import type { TransformResult, Plugin as VitePlugin } from "vite";
import type { getBundlerConfig } from "./bundler.ts";
import type { Fastnode, FastnodeConfig, FastnodeModule, ViteServiceConfig } from "fastnode/types";
import type { RunnerManager } from "env-runner";
import type { FastnodeDevApp } from "../../../dev/app.ts";

export type { ViteServiceConfig } from "fastnode/types";

declare module "vite" {
  interface UserConfig {
    /**
     * Fastnode Vite Plugin options.
     */
    fastnode?: FastnodeConfig;
  }

  interface Plugin {
    fastnode?: FastnodeModule;
  }
}

export interface FastnodePluginConfig extends FastnodeConfig {
  /**
   * Existing Fastnode instance to use instead of creating one (for frameworks that create Fastnode themselves).
   */
  _fastnode?: Fastnode;
}

export interface FastnodePluginContext {
  fastnode?: Fastnode;
  pluginConfig: FastnodePluginConfig;
  bundlerConfig?: Awaited<ReturnType<typeof getBundlerConfig>>;
  devApp?: FastnodeDevApp;
  services: Record<string, ViteServiceConfig>;

  _isRolldown?: boolean;
  _isVitest?: boolean;
  _initialized?: boolean;
  _viteVersionChecked?: boolean;
  _envRunner?: RunnerManager;
  _closingEnvRunner?: boolean;
  _closePromise?: Promise<void>;
  _initPromise?: Promise<RunnerManager>;
  _viteEnvs?: Map<string, string>;
  _transformRequest?: (id: string) => Promise<TransformResult | null | undefined>;
  _publicDistDir?: string;
  _entryPoints: Record<string, string>;
  _pluginModules?: VitePlugin[];
  _fastnodeEnvAliases?: string[];
}
