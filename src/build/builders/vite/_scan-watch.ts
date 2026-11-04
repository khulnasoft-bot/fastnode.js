import type { Fastnode } from "fastnode/types";
import type { DevEnvironment, ViteDevServer } from "vite";
import { basename, dirname, join, normalize } from "pathe";
import { scanHandlers } from "../../../core/application/scan.ts";
import { onWatchError } from "../../../utils/watch.ts";

const serverEntryRe = /^server\.[mc]?[jt]sx?$/;
const watchReloadEvents = new Set(["add", "addDir", "unlink", "unlinkDir"]);

/**
 * Calls `onChange` when files are added to or removed from the scan dirs (or a root `server.*`
 * entry), and on the `build:reload` hook.
 */
export function watchScanDirs(
  fastnode: Fastnode,
  server: ViteDevServer,
  onChange: () => void
): void {
  const scanDirs = fastnode.options.scanDirs.flatMap((dir) => [
    join(dir, fastnode.options.apiDir || "api"),
    join(dir, fastnode.options.routesDir || "routes"),
    join(dir, "middleware"),
    join(dir, "plugins"),
    join(dir, "modules"),
  ]);

  const shouldReload = (path: string) => {
    path = normalize(path);
    return (
      scanDirs.some((dir) => path === dir || path.startsWith(dir + "/")) ||
      (serverEntryRe.test(basename(path)) && dirname(path) + "/" === fastnode.options.rootDir)
    );
  };

  // Reuse vite's watcher (root is already watched) to avoid extra system watchers
  server.watcher.on("error", (error) => onWatchError(fastnode, error));
  server.watcher.add(scanDirs.filter((dir) => !dir.startsWith(server.config.root + "/")));
  server.watcher.on("all", (event, path) => {
    if (watchReloadEvents.has(event) && shouldReload(path)) {
      onChange();
    }
  });
  fastnode.hooks.hook("build:reload", () => onChange());
}

/**
 * Rescans handlers and invalidates the `fastnode` environment, so virtual modules render again.
 */
export async function rescanHandlers(fastnode: Fastnode, env: DevEnvironment): Promise<void> {
  await scanHandlers(fastnode);
  fastnode.routing.sync();
  env.moduleGraph.invalidateAll();
}
