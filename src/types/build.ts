import type {
  InputOptions as RollupInputOptions,
  InputPluginOption as RollupInputPluginOption,
  OutputOptions as RollupOutputOptions,
} from "rollup";
import type {
  InputOptions as RolldownInputOptions,
  OutputOptions as RolldownOutputOptions,
  MinifyOptions as RolldownMinifyOptions,
  RolldownPluginOption,
} from "rolldown";
import type {
  BundlerInputOptions,
  BundlerMinifyOptions,
  BundlerOutputOptions,
} from "./_bundler.ts";
import type { OptionalDepType } from "./_utils.ts";
import type { TransformOptions as OXCTransformOptions } from "oxbox";

/**
 * A build plugin (Rollup plugin interface), applied with every builder.
 *
 * Rollup, Rolldown and Vite plugins are accepted. Only `resolveId`, `load` and `transform` are
 * supported by all builders (`builder: false` runs plugins in env-runner, which supports only
 * these).
 */
export interface FastnodeBuildPlugin {
  name: string;
  /** Run before (`"pre"`) or after (`"post"`) the other plugins. */
  enforce?: "pre" | "post";
  resolveId?: FastnodeBuildPluginHook<
    (this: any, source: string, importer: string | undefined, options: any) => any
  >;
  load?: FastnodeBuildPluginHook<(this: any, id: string, options?: any) => any>;
  transform?: FastnodeBuildPluginHook<(this: any, code: string, id: string, options?: any) => any>;
  /** Builder-specific hooks and options. */
  [key: string]: any;
}

export type FastnodeBuildPluginHook<Handler> =
  | Handler
  | {
      order?: "pre" | "post" | null;
      filter?: FastnodeBuildPluginHookFilter | readonly unknown[];
      handler: Handler;
    };

export interface FastnodeBuildPluginHookFilter {
  id?: FastnodeBuildPluginStringFilter;
  code?: FastnodeBuildPluginStringFilter;
  moduleType?: FastnodeBuildPluginStringFilter;
}

export type FastnodeBuildPluginStringFilter =
  | MaybeArray<string | RegExp>
  | { include?: MaybeArray<string | RegExp>; exclude?: MaybeArray<string | RegExp> };

/** `buildPlugins` entries: nested arrays and promises are resolved, falsy ones skipped. */
export type FastnodeBuildPluginOption = MaybePromise<
  FastnodeBuildPlugin | false | null | undefined | FastnodeBuildPluginOption[]
>;

export type RollupConfig = OptionalDepType<
  Omit<RollupInputOptions, "plugins">,
  BundlerInputOptions
> & {
  output?: OptionalDepType<RollupOutputOptions, BundlerOutputOptions>;
  // `rollupConfig` is also reused for the `rolldown` builder (see `build/vite/bundler.ts`),
  // so it accepts a mix of Rollup, Rolldown and Vite plugins.
  plugins?: (
    | OptionalDepType<RollupInputPluginOption, FastnodeBuildPluginOption>
    | OptionalDepType<RolldownPluginOption, FastnodeBuildPluginOption>
  )[];
};

export type RolldownConfig = OptionalDepType<
  RolldownInputOptions,
  BundlerInputOptions & { plugins?: FastnodeBuildPluginOption[] }
> & {
  output?: OptionalDepType<RolldownOutputOptions, BundlerOutputOptions>;
};

/**
 * Bundler config passed to the `build:config` hook, keyed by the bundler in use.
 *
 * The `vite` builder passes a Rollup or Rolldown config, depending on the Vite version.
 */
export type FastnodeBuildConfig =
  | { builder: "rollup" | "vite"; rollup: RollupConfig; rolldown?: never }
  | { builder: "rolldown" | "vite"; rolldown: RolldownConfig; rollup?: never };

export interface OXCOptions {
  minify?: OptionalDepType<RolldownMinifyOptions, BundlerMinifyOptions>;
  transform?: Omit<OXCTransformOptions, "jsx"> & {
    jsx?: Exclude<OXCTransformOptions["jsx"], false | string>;
  };
}

type MaybePromise<T> = T | Promise<T>;

type MaybeArray<T> = T | readonly T[];
