import type { Fastnode } from "fastnode/types";
import type { WranglerConfig } from "./types.ts";
import { join } from "pathe";
import { presetsDir } from "#fastnode/meta";
import { readWranglerConfig } from "./utils.ts";

// Named exports of the server entry (e.g. Durable Objects) are Worker exports
export function setupEntryExports(fastnode: Fastnode, opts: { durableObject?: boolean } = {}) {
  const serverEntry = fastnode.options.serverEntry && fastnode.options.serverEntry.handler;
  if (!serverEntry && !opts.durableObject) return;

  const originalEntry = fastnode.options.entry;
  const virtualEntryId = (fastnode.options.entry = "#fastnode/virtual/cloudflare-server-entry");
  fastnode.options.virtual[virtualEntryId] = /* js */ `
    ${serverEntry ? `export * from ${JSON.stringify(serverEntry)};` : ""}
    ${opts.durableObject ? `export { $DurableObject } from ${_durableRuntime};` : ""}
    export * from ${JSON.stringify(originalEntry)};
    export { default } from ${JSON.stringify(originalEntry)};
  `;
}

/**
 * Worker exports of the miniflare dev runner. The built-in `$DurableObject` class (exported by the
 * `cloudflare-module` entry) is only added when the Wrangler config declares it, as the runner
 * warns about undeclared Durable Objects.
 */
export async function setupDevEntryExports(fastnode: Fastnode) {
  const durableObject = await _declaresDurableObject(fastnode);
  if (fastnode.options.builder !== "vite") {
    setupEntryExports(fastnode, { durableObject });
    return;
  }
  // In Vite dev, the fastnode environment's entry re-exports them instead (`vite/dev-entry.mjs`)
  if (durableObject) {
    fastnode.options.virtual["#fastnode/virtual/dev-worker-exports"] =
      `export { $DurableObject } from ${_durableRuntime};`;
  }
}

const _durableRuntime = JSON.stringify(join(presetsDir, "cloudflare/runtime/_durable"));

// Bound or exported in the selected environment of the Wrangler config file or inline config
async function _declaresDurableObject(fastnode: Fastnode): Promise<boolean> {
  const { config = {} } = await readWranglerConfig(fastnode).catch(() => ({ config: undefined }));
  const inlineConfig = fastnode.options.cloudflare?.wrangler || {};
  const envName = fastnode.options.cloudflare?.wranglerEnv ?? process.env.CLOUDFLARE_ENV;
  // A `script_name` of the Worker itself is a local binding, as in `wrangler dev`
  const workerName = _workerName(inlineConfig, envName) ?? _workerName(config, envName);
  return [config, inlineConfig].some((source: WranglerConfig) => {
    const target = (envName && source.env?.[envName]) || source;
    return (
      !!target.exports?.$DurableObject ||
      !!target.durable_objects?.bindings?.some(
        (binding) =>
          binding.class_name === "$DurableObject" &&
          (!binding.script_name || binding.script_name === workerName)
      )
    );
  });
}

// Worker name in the selected environment: its own `name`, else `<name>-<env>`
function _workerName(config: WranglerConfig, envName?: string): string | undefined {
  const envWorkerName = envName ? config.env?.[envName]?.name : undefined;
  if (envWorkerName) {
    return envWorkerName;
  }
  if (config.name) {
    return envName ? `${config.name}-${envName}` : config.name;
  }
  return undefined;
}
