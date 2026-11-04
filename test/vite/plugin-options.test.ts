import { fileURLToPath } from "node:url";
import type { UserConfig } from "vite";
import type { Fastnode } from "fastnode/types";
import { afterEach, describe, expect, test } from "vitest";
import { fastnode } from "../../src/vite.ts";
import type { FastnodePluginConfig } from "../../src/vite.ts";
import { createFastnode } from "../../src/core/application/fastnode.ts";

const { resolveConfig } = (await import(
  process.env.FASTNODE_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./plugin-options-fixture", import.meta.url));

describe("vite: plugin options", () => {
  const instances: Fastnode[] = [];

  afterEach(async () => {
    await Promise.all(instances.splice(0).map((instance) => instance.close()));
  });

  async function resolve(pluginConfig: FastnodePluginConfig = {}, userConfig: UserConfig = {}) {
    let fastnodeInstance: Fastnode | undefined;
    const config = await resolveConfig(
      {
        root: rootDir,
        configFile: false,
        logLevel: "silent",
        ...userConfig,
        plugins: [
          fastnode(pluginConfig),
          {
            name: "capture",
            fastnode: { setup: (n) => void instances.push((fastnodeInstance = n)) },
          },
        ],
      },
      "build"
    );
    return { config, fastnode: fastnodeInstance! };
  }

  test("reads `vite` options from fastnode.config", async () => {
    const { config, fastnode } = await resolve();
    expect(Object.keys(config.environments)).toEqual(
      expect.arrayContaining(["api", "ssr", "fastnode"])
    );
    expect(fastnode.options.vite?.assetsImport).toBe(false);
    // `?assets` support makes the ssr environment emit assets
    expect(config.environments.ssr.build.emitAssets).toBe(false);
  });

  test("inline plugin options override fastnode.config", async () => {
    const { config } = await resolve({ vite: { assetsImport: true } });
    expect(config.environments.ssr.build.emitAssets).toBe(true);
  });

  test("reads `vite` options from the `fastnode` key of the vite config", async () => {
    const { config, fastnode } = await resolve(
      {},
      { fastnode: { vite: { services: { other: { entry: "./api-entry.ts" } } } } }
    );
    expect(Object.keys(config.environments)).toEqual(expect.arrayContaining(["api", "other"]));
    expect(Object.keys(fastnode.options.vite?.services || {}).sort()).toEqual(["api", "other"]);
  });

  test("reads inline `vite` options on a provided fastnode instance", async () => {
    const provided = await createFastnode({ rootDir });
    const { config, fastnode } = await resolve({
      _fastnode: provided,
      vite: { assetsImport: true, services: { other: { entry: "./api-entry.ts" } } },
    });
    expect(Object.keys(config.environments)).toEqual(
      expect.arrayContaining(["api", "other", "fastnode"])
    );
    expect(fastnode.options.vite?.assetsImport).toBe(true);
    expect(config.environments.ssr.build.emitAssets).toBe(true);
    expect(Object.keys(fastnode.options.vite?.services || {}).sort()).toEqual(["api", "other"]);
  });
});
