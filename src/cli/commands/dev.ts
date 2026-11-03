import type { Fastnode, FastnodeConfig } from "fastnode/types";
import { defineCommand } from "citty";
import { consola } from "consola";
import { build, createFastnode, prepare } from "fastnode/builder";
import { resolve } from "pathe";
import { commonArgs } from "../common.ts";
import { createDevServer } from "../../dev/server.ts";
import { onWatchError } from "../../utils/watch.ts";

const hmrKeyRe = /^runtimeConfig\.|routeRules\./;

export default defineCommand({
  meta: {
    name: "dev",
    description: "Start the development server",
  },
  args: {
    ...commonArgs,
    port: { type: "string", description: "specify port" },
    host: { type: "string", description: "specify hostname " },
    envName: {
      type: "string",
      description:
        "The environment name used to apply `$env.<name>` config overrides and exposed as `import.meta.envName` (default: `development`).",
    },
  },
  async run({ args }) {
    await runDev({
      rootDir: resolve((args.dir || args._dir || ".") as string),
      port: args.port,
      host: args.host,
      envName: args.envName,
    });
  },
});

export async function runDev(opts: {
  rootDir: string;
  port?: string;
  host?: string;
  envName?: string;
  config?: FastnodeConfig;
}) {
  let fastnode: Fastnode;
  // Watcher errors (e.g. ENOSPC) from bundler internals cannot be handled at the source
  process.on("uncaughtException", (error) => {
    if ((error as NodeJS.ErrnoException)?.syscall !== "watch") {
      throw error;
    }
    onWatchError(fastnode || { logger: consola }, error);
  });
  const reload = async () => {
    if (fastnode) {
      consola.info("Restarting dev server...");
      if ("unwatch" in fastnode.options._c12) {
        await fastnode.options._c12.unwatch();
      }
      await fastnode.close();
    }
    fastnode = await createFastnode(
      {
        ...opts.config,
        rootDir: opts.rootDir,
        dev: true,
        _cli: { command: "dev" },
      },
      {
        watch: true,
        c12: {
          envName: opts.envName,
          async onUpdate({ getDiff, newConfig }) {
            const diff = getDiff();

            if (diff.length === 0) {
              return; // No changes
            }

            consola.info(
              "Fastnode config updated:\n" + diff.map((entry) => `  ${entry.toString()}`).join("\n")
            );

            await (diff.every((e) => hmrKeyRe.test(e.key))
              ? fastnode.updateConfig(newConfig.config || {}) // Hot reload
              : reload()); // Full reload
          },
        },
      }
    );
    fastnode.hooks.hookOnce("restart", reload);
    const server = createDevServer(fastnode);

    await server.listen({
      port: opts.port || fastnode.options.devServer.port,
      hostname: opts.host || fastnode.options.devServer.hostname,
    });
    await prepare(fastnode);
    await build(fastnode);
  };
  await reload();
}
