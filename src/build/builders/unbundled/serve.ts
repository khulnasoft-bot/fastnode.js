import type { EnvRunner, ListenOptions } from "env-runner";
import type { Fastnode } from "fastnode/types";

import { loadRunner } from "env-runner";
import { joinURL, withTrailingSlash } from "ufo";
import { createFastnode } from "../../../core/application/fastnode.ts";
import { scanHandlers } from "../../../core/application/scan.ts";
import { globPublicAssets } from "../../assets.ts";
import { resolveBuildPlugins } from "../../plugins.ts";
import { prepareUnbundledApp } from "./entry.ts";
import { unbundledPlugins } from "./plugins.ts";

const serveDotenv = { fileName: [".env.production", ".env"] };

// The Fastnode runtime modules a self runner imports stay cached in the process (with the
// virtual modules they import): only its first server can run in it.
let selfRunnerUsed = false;

export interface UnbundledServerOptions {
  rootDir: string;
  /** Environment name used to apply `$env.<name>` config overrides (default: `production`). */
  envName?: string;
  /** Public address the worker listens on. */
  listen?: ListenOptions;
  /** Called when the worker closes, also when it crashes. */
  onClose?: (cause?: unknown) => void;
}

export interface UnbundledServer {
  fastnode: Fastnode;
  runner: EnvRunner;
  /** Stop accepting connections, wait for in-flight requests, then run the `close` hooks. */
  close: () => Promise<void>;
}

/**
 * Serve the server sources in production without a build (`builder: false`).
 *
 * The sources run in this process (env-runner self runner), whose loader hooks need
 * synchronous plugins. With `buildPlugins`, which may be async, or for later servers of the
 * process, they run in a Node.js worker instead, while the host loads and transforms the
 * modules it imports.
 * Either way, the server listens on the public address itself.
 */
export async function startUnbundledServer(opts: UnbundledServerOptions): Promise<UnbundledServer> {
  const fastnode = await createFastnode(
    { rootDir: opts.rootDir, dev: false, preset: "fastnode-serve", builder: false },
    { dotenv: serveDotenv, c12: { envName: opts.envName } }
  );
  let runner: EnvRunner | undefined;
  let closeCause: unknown;
  try {
    await fastnode.hooks.callHook("build:before", fastnode);
    await scanHandlers(fastnode);
    fastnode.routing.sync();
    const { entry, virtual, appEntry } = await prepareUnbundledApp(fastnode);
    await fastnode.hooks.callHook("compiled", fastnode);
    const publicAssets = await scanPublicAssets(fastnode);
    if (publicAssets.length > 0) {
      virtual[entry] = serveEntry(appEntry, publicAssets);
    }
    const self = !selfRunnerUsed && (await resolveBuildPlugins(fastnode)).length === 0;
    selfRunnerUsed ||= self;
    runner = await loadRunner(self ? "self" : "node-worker", {
      name: "fastnode-serve",
      data: { entry, virtual },
      plugins: await unbundledPlugins(fastnode, { sync: self }),
      // After `createFastnode`, so `.env` files can set them
      listen: opts.listen && {
        ...opts.listen,
        port: opts.listen.port ?? process.env.FASTNODE_PORT,
        hostname: opts.listen.hostname || process.env.FASTNODE_HOST,
      },
      hooks: {
        onClose: (_runner, cause) => {
          closeCause = cause;
          opts.onClose?.(cause);
        },
      },
    });
    await runner.waitForReady();
  } catch (error) {
    await runner?.close();
    await fastnode.close();
    // A worker failing to start (e.g. port taken) closes the runner with the cause
    throw closeCause ?? error;
  }
  return {
    fastnode,
    runner,
    async close() {
      await (runner.shutdown?.() ?? runner.close());
      await fastnode.close();
    },
  };
}

interface ServedPublicAssets {
  /** Base URL (with `baseURL` and a trailing slash). */
  base: string;
  dir: string;
  /** File paths (relative to `base`, with a leading slash). */
  files: string[];
}

/** Public assets indexed once, so requests for other paths skip the file system. */
async function scanPublicAssets(fastnode: Fastnode): Promise<ServedPublicAssets[]> {
  if (fastnode.options.noPublicDir) {
    return [];
  }
  const assets: ServedPublicAssets[] = [];
  for (const asset of fastnode.options.publicAssets) {
    const files = await globPublicAssets(fastnode, asset);
    if (files.length === 0) {
      continue;
    }
    assets.push({
      base: withTrailingSlash(joinURL(fastnode.options.baseURL, asset.baseURL || "/")),
      dir: asset.dir,
      files: files.map((file) => `/${file}`),
    });
  }
  return assets;
}

/** Entry serving the public assets from their source directories before the app. */
function serveEntry(appEntry: string, publicAssets: ServedPublicAssets[]): string {
  return /* js */ `
import app from ${JSON.stringify(appEntry)};
import { staticMiddleware } from ${JSON.stringify(import.meta.resolve("srvx/static"))};

globalThis.__fastnode_main__ = import.meta.url;

const publicAssets = ${JSON.stringify(publicAssets)}.map((asset) => ({
  base: asset.base,
  files: new Set(asset.files),
  handler: staticMiddleware({ dir: asset.dir }),
}));

// The indexed file for a path, in srvx staticMiddleware order (also .html and index.html)
function resolveFile(files, path) {
  if (path.endsWith("/")) {
    path += "index.html";
    return files.has(path) ? path : undefined;
  }
  if (files.has(path)) return path;
  if (files.has(path + ".html")) return path + ".html";
  if (files.has(path + "/index.html")) return path + "/index.html";
}

function servePublicAssets(req, next) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  const pathname = (req._url ??= new URL(req.url)).pathname;
  for (const asset of publicAssets) {
    if (!pathname.startsWith(asset.base)) {
      continue;
    }
    let path = pathname.slice(asset.base.length - 1);
    if (path.includes("%")) {
      try {
        path = decodeURI(path);
      } catch {
        continue;
      }
    }
    const file = resolveFile(asset.files, path);
    if (!file) {
      continue;
    }
    // Request the indexed file itself, so srvx can not pick an ignored one before it
    const target = path.endsWith("/") ? path : file;
    let assetReq = req;
    if (asset.base !== "/" || target !== path) {
      const url = new URL(req.url);
      url.pathname = encodeURI(target);
      assetReq = new Request(url, req);
    }
    return Promise.resolve(asset.handler(assetReq, () => undefined)).then((res) => res || next());
  }
  return next();
}

export default { ...app, middleware: [servePublicAssets, ...(app.middleware || [])] };
`.trimStart();
}
