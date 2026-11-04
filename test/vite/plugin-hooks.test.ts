import { fileURLToPath } from "node:url";
import type { Fastnode, FastnodeBuildConfig } from "fastnode/types";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fastnode } from "../../src/vite.ts";

const { resolveConfig } = (await import(
  process.env.FASTNODE_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./app-fixture", import.meta.url));

// #1382: hooks with the same name from `fastnode()` options and the `fastnode` key of the Vite config
// must both run instead of overriding each other.
describe("vite: plugin and user config hooks", () => {
  let instance: Fastnode | undefined;

  afterEach(async () => {
    await instance?.close();
    instance = undefined;
  });

  test("runs hooks with the same name from plugin options and user config", async () => {
    const calls: string[] = [];
    await resolveConfig(
      {
        root: rootDir,
        configFile: false,
        fastnode: {
          hooks: {
            compiled: () => {
              calls.push("config:compiled");
            },
            build: {
              config: () => {
                calls.push("config:build:config");
              },
            },
          },
        },
        plugins: [
          fastnode({
            serverDir: "./",
            hooks: {
              compiled: () => {
                calls.push("plugin:compiled");
              },
              "build:config": () => {
                calls.push("plugin:build:config");
              },
            },
          }),
          {
            name: "capture-fastnode",
            fastnode: {
              setup(fastnode) {
                instance = fastnode;
              },
            },
          },
        ],
      },
      "build"
    );

    // `build:config` already runs while resolving the bundler config
    calls.splice(0);
    await instance!.hooks.callHook("compiled", instance!);
    await instance!.hooks.callHook("build:config", instance!, { builder: "vite", rolldown: {} });
    expect(calls).toEqual([
      "config:compiled",
      "plugin:compiled",
      "config:build:config",
      "plugin:build:config",
    ]);
  });

  test("calls deprecated `rollup:before` hooks with the bundler config", async () => {
    let buildConfig: FastnodeBuildConfig | undefined;
    let legacyConfig: unknown;
    await resolveConfig(
      {
        root: rootDir,
        configFile: false,
        plugins: [
          fastnode({
            serverDir: "./",
            hooks: {
              "build:config": (_fastnode, config) => {
                buildConfig = config;
              },
              "rollup:before": (_fastnode, config) => {
                legacyConfig = config;
              },
            },
          }),
          {
            name: "capture-fastnode",
            fastnode: {
              setup(fastnode) {
                instance = fastnode;
                vi.spyOn(fastnode.logger, "warn").mockImplementation(() => {});
              },
            },
          },
        ],
      },
      "build"
    );

    expect(buildConfig?.builder).toBe("vite");
    expect(legacyConfig).toBeDefined();
    expect(legacyConfig).toBe(buildConfig?.rollup ?? buildConfig?.rolldown);
  });
});
