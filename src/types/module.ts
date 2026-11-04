import type { Fastnode } from "./fastnode.ts";

/**
 * Accepted input formats for Fastnode modules.
 *
 * Can be a module path string, a {@link FastnodeModule} object, a bare setup
 * function, or an object with a `fastnode` key containing a {@link FastnodeModule}.
 *
 * @see https://fastnode.khulnasoft.com/config/features#modules
 */
export type FastnodeModuleInput =
  | string
  | FastnodeModule
  | FastnodeModule["setup"]
  | { fastnode: FastnodeModule };

/**
 * A Fastnode module that extends behavior during initialization.
 *
 * Modules receive the {@link Fastnode} instance and can register hooks,
 * add handlers, modify options, or perform other setup tasks.
 *
 * @example
 * ```ts
 * export default {
 *   name: "my-module",
 *   fastnode: {
 *     setup(fastnode) {
 *       fastnode.hooks.hook("compiled", () => {
 *         console.log("Build complete!");
 *       });
 *     },
 *   },
 * };
 * ```
 *
 * @see https://fastnode.khulnasoft.com/config/features#modules
 */
export interface FastnodeModule {
  name?: string;
  setup: (this: void, fastnode: Fastnode) => void | Promise<void>;
}
