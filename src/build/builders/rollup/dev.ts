import type { Fastnode, RollupConfig } from "fastnode/types";
import type { RollupOptions, RollupWatcher } from "rollup";
import { defu } from "defu";
import { basename, join } from "pathe";
import { debounce } from "perfect-debounce";
import { scanHandlers } from "../../../core/application/scan.ts";
import { createWatcher } from "../../../utils/watch.ts";
import { formatRollupError } from "./error.ts";
import { formatCompatibilityDate } from "compatx";
import { importRollup } from "./_import.ts";

export async function watchDev(fastnode: Fastnode, rollupConfig: RollupConfig) {
  const rollup = await importRollup(fastnode);

  let rollupWatcher: RollupWatcher;

  async function load() {
    if (rollupWatcher) {
      await rollupWatcher.close();
    }
    await scanHandlers(fastnode);
    fastnode.routing.sync();
    rollupWatcher = startRollupWatcher(fastnode, rollupConfig);
  }
  const reload = debounce(load);

  const scanDirs = fastnode.options.scanDirs.flatMap((dir) => [
    join(dir, fastnode.options.apiDir || "api"),
    join(dir, fastnode.options.routesDir || "routes"),
    join(dir, "middleware"),
    join(dir, "plugins"),
    join(dir, "modules"),
  ]);

  const watchReloadEvents = new Set(["add", "addDir", "unlink", "unlinkDir"]);
  const scanDirsWatcher = createWatcher(fastnode, scanDirs, {
    ignoreInitial: true,
  }).on("all", (event, path, stat) => {
    if (watchReloadEvents.has(event)) {
      reload();
    }
  });

  const serverEntryRe = /^server\.[mc]?[jt]sx?$/;
  const rootDirWatcher = createWatcher(fastnode, fastnode.options.rootDir, {
    ignoreInitial: true,
    depth: 0,
  }).on("all", (event, path) => {
    if (watchReloadEvents.has(event) && serverEntryRe.test(basename(path))) {
      reload();
    }
  });

  fastnode.hooks.hook("close", () => {
    rollupWatcher.close();
    scanDirsWatcher.close();
    rootDirWatcher.close();
  });

  fastnode.hooks.hook("build:reload", () => reload());

  fastnode.logger.info(
    `Starting dev watcher (builder: \`rollup\`, preset: \`${fastnode.options.preset}\`, compatibility date: \`${formatCompatibilityDate(fastnode.options.compatibilityDate)}\`)`
  );

  await load();

  function startRollupWatcher(fastnode: Fastnode, rollupConfig: RollupConfig) {
    const watcher = rollup.watch(
      defu(rollupConfig as RollupOptions, {
        watch: {
          chokidar: fastnode.options.watchOptions,
        },
      })
    );
    let start: number;

    watcher.on("event", (event) => {
      // START > BUNDLE_START > BUNDLE_END > END
      // START > BUNDLE_START > ERROR > END
      switch (event.code) {
        case "START": {
          start = Date.now();
          fastnode.hooks.callHook("dev:start");
          break;
        }
        case "BUNDLE_END": {
          fastnode.hooks.callHook("compiled", fastnode);
          if (fastnode.options.logging.buildSuccess) {
            fastnode.logger.success(`Server built`, start ? `in ${Date.now() - start}ms` : "");
          }
          fastnode.hooks.callHook("dev:reload");
          break;
        }
        case "ERROR": {
          fastnode.logger.error(formatRollupError(event.error));
          fastnode.hooks.callHook("dev:error", event.error);
        }
      }
    });

    return watcher;
  }
}
