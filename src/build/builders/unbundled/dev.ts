import type { Fastnode } from "fastnode/types";
import { formatCompatibilityDate } from "compatx";
import { normalize } from "pathe";
import { withTrailingSlash } from "ufo";
import { debounce } from "perfect-debounce";
import { scanHandlers } from "../../../core/application/scan.ts";
import { createWatcher } from "../../../utils/watch.ts";
import { prepareUnbundledApp } from "./entry.ts";
import { unbundledPlugins } from "./plugins.ts";

// Dependencies, and dot directories (build output, `.data`, `.wrangler`, ...) the app may write to
const ignoredRe = /(?:^|\/)(?:node_modules|\.[^/]+)(?:\/|$)/;

// Files that can be part of the server: scripts, and files imported as text, bytes or WASM
const sourceRe = /\.(?:[cm]?[jt]sx?|json|wasm|txt|html|md|ya?ml|toml|sql)$/;

export async function watchDev(fastnode: Fastnode) {
  fastnode.logger.info(
    `Starting dev server without a builder (preset: \`${fastnode.options.preset}\`, compatibility date: \`${formatCompatibilityDate(fastnode.options.compatibilityDate)}\`)`
  );

  const plugins = await unbundledPlugins(fastnode);

  async function load() {
    await fastnode.hooks.callHook("dev:start");
    try {
      await scanHandlers(fastnode);
      fastnode.routing.sync();
      const { entry, virtual } = await prepareUnbundledApp(fastnode);
      await fastnode.hooks.callHook("compiled", fastnode);
      await fastnode.hooks.callHook("dev:reload", { entry, workerData: { virtual }, plugins });
    } catch (error) {
      fastnode.logger.error(error);
      await fastnode.hooks.callHook("dev:error", error);
    }
  }
  const reload = debounce(load);

  // Without a module graph, any source change starts a fresh worker
  const { rootDir, scanDirs, buildDir, output, publicAssets, watchOptions } = fastnode.options;
  const watchDirs = [...new Set([rootDir, ...scanDirs].map((dir) => withTrailingSlash(dir)))];
  const ignoredDirs = [buildDir, output.dir, ...publicAssets.map((asset) => asset.dir)].map((dir) =>
    withTrailingSlash(dir)
  );
  const watcher = createWatcher(fastnode, watchDirs, {
    ignoreInitial: true,
    ...watchOptions,
    ignored: [
      (path) => {
        path = normalize(path);
        const watchDir = watchDirs.find((dir) => path.startsWith(dir));
        return (
          (watchDir !== undefined && ignoredRe.test(path.slice(watchDir.length))) ||
          ignoredDirs.some((dir) => path.startsWith(dir))
        );
      },
      ...[watchOptions?.ignored ?? []].flat(),
    ],
  }).on("all", (event, path) => {
    if (event === "addDir" || event === "unlinkDir" || sourceRe.test(path)) {
      reload();
    }
  });

  fastnode.hooks.hook("close", () => watcher.close());
  fastnode.hooks.hook("build:reload", () => reload());

  await load();
}
