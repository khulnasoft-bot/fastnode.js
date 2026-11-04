import type { Fastnode } from "fastnode/types";

import { EnvServer } from "env-runner";
import { scanHandlers } from "../../../core/application/scan.ts";
import { prepareUnbundledApp } from "./entry.ts";
import { unbundledPlugins } from "./plugins.ts";

/**
 * Start the prerenderer from the server sources, without a build (`builder: false`).
 *
 * Runs in a Node.js worker, like the prerenderer built by a bundler.
 */
export async function startUnbundledPrerenderer(fastnode: Fastnode): Promise<EnvServer> {
  await fastnode.hooks.callHook("build:before", fastnode);
  await scanHandlers(fastnode);
  fastnode.routing.sync();
  const { entry, virtual } = await prepareUnbundledApp(fastnode);
  await fastnode.hooks.callHook("compiled", fastnode);
  return new EnvServer({
    runner: "node-worker",
    name: "fastnode-prerender",
    entry,
    data: { virtual },
    plugins: await unbundledPlugins(fastnode),
  }).start();
}
