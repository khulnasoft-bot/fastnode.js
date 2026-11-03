import { afterEach, describe, expect, it, vi } from "vitest";

const ZEPHYR_PRESET_PATH = "../../src/presets/zephyr/preset.ts";

const importDepMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/utils/dep.ts", () => ({
  importDep: importDepMock,
}));

async function getZephyrPreset() {
  const { default: presets } = await import(ZEPHYR_PRESET_PATH);
  return presets[0];
}

describe("zephyr preset", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("extends base-worker", async () => {
    const preset = await getZephyrPreset();
    expect(preset.extends).toBe("base-worker");
    expect(preset.output?.publicDir).toBe("{{ output.dir }}/client/{{ baseURL }}");
    expect(preset.commands?.deploy).toBeTypeOf("function");
  });

  it("adds cloudflare externals and node compat", async () => {
    const preset = await getZephyrPreset();
    const hooks = preset.hooks!;

    const fastnode = {
      options: {
        preset: "zephyr",
        rootDir: process.cwd() + "/",
        output: {
          dir: "/tmp/zephyr-output",
          serverDir: "/tmp/zephyr-output/server",
        },
        alias: { "node:fs": "/custom/fs" },
        inject: {},
        polyfills: [],
        builtinModules: [],
        unenv: [],
      },
      logger: {
        info: vi.fn(),
        success: vi.fn(),
      },
    } as any;

    await hooks["build:before"]?.(fastnode);
    expect(fastnode.options.alias).toEqual({ "node:fs": "/custom/fs" });
    const { resolveBuildEnv } = await import("../../src/build/env.ts");
    const env = await resolveBuildEnv(fastnode);
    expect(env.external).toContain("cloudflare:workers");
    expect(env.external).toContain("node:fs");
    expect(env.alias["node:path"]).toBe("node:path");
    expect(env.alias["node:fs"]).toBe("/custom/fs");
    expect(env.inject.Buffer).toEqual(["node:buffer", "Buffer"]);
    expect(fastnode.logger.info).not.toHaveBeenCalled();
    expect(fastnode.logger.success).not.toHaveBeenCalled();
  });

  it("deploys with the deploy command", async () => {
    const uploadOutputToZephyr = vi.fn().mockResolvedValue({
      deploymentUrl: "https://example.zephyr-cloud.io",
      entrypoint: "server/index.mjs",
    });
    importDepMock.mockResolvedValue({ uploadOutputToZephyr });

    const preset = await getZephyrPreset();

    const fastnode = {
      options: {
        rootDir: "/tmp/project",
        baseURL: "/docs/",
        output: {
          dir: "/tmp/zephyr-output",
          publicDir: "client/docs",
        },
      },
      logger: {
        info: vi.fn(),
        success: vi.fn(),
      },
    } as any;

    await (preset.commands!.deploy as (fastnode: any) => Promise<void>)(fastnode);

    expect(importDepMock).toHaveBeenCalledWith({
      id: "zephyr-agent",
      dir: "/tmp/project",
    });
    expect(uploadOutputToZephyr).toHaveBeenCalledWith({
      rootDir: "/tmp/project",
      baseURL: "/docs/",
      outputDir: "/tmp/zephyr-output",
      publicDir: "/tmp/zephyr-output/client/docs",
    });
    expect(fastnode.logger.success).toHaveBeenCalledWith(
      "[zephyr-fastnode-preset] Zephyr deployment succeeded: https://example.zephyr-cloud.io"
    );
    expect(fastnode.logger.info).not.toHaveBeenCalled();
  });

  it("skips deploy on build by default", async () => {
    const uploadOutputToZephyr = vi.fn().mockResolvedValue({
      deploymentUrl: "https://example.zephyr-cloud.io",
      entrypoint: "server/index.mjs",
    });
    importDepMock.mockResolvedValue({ uploadOutputToZephyr });

    const preset = await getZephyrPreset();
    const hooks = preset.hooks!;
    const fastnode = {
      options: {
        output: {
          dir: "/tmp/zephyr-output",
        },
      },
      logger: {
        info: vi.fn(),
        success: vi.fn(),
      },
    } as any;

    await hooks.compiled?.(fastnode);

    expect(importDepMock).not.toHaveBeenCalled();
    expect(uploadOutputToZephyr).not.toHaveBeenCalled();
    expect(fastnode.logger.info).toHaveBeenCalledWith(
      "[zephyr-fastnode-preset] Skipping Zephyr deploy on build (use `fastnode deploy` or set `zephyr.deployOnBuild`)."
    );
    expect(fastnode.logger.success).not.toHaveBeenCalled();
  });

  it("deploys on build once with deployOnBuild", async () => {
    const uploadOutputToZephyr = vi.fn().mockResolvedValue({ deploymentUrl: undefined });
    importDepMock.mockResolvedValue({ uploadOutputToZephyr });

    const preset = await getZephyrPreset();
    const hooks = preset.hooks!;
    const fastnode = {
      options: {
        rootDir: "/tmp/project",
        baseURL: "/",
        zephyr: { deployOnBuild: true },
        output: {
          dir: "/tmp/zephyr-output",
          publicDir: "client",
        },
      },
      logger: {
        info: vi.fn(),
        success: vi.fn(),
      },
    } as any;

    await hooks.compiled?.(fastnode);
    expect(uploadOutputToZephyr).toHaveBeenCalledTimes(1);
    expect(fastnode.logger.success).toHaveBeenCalledWith(
      "[zephyr-fastnode-preset] Zephyr deployment succeeded."
    );

    await (preset.commands!.deploy as (fastnode: any) => Promise<void>)(fastnode);
    expect(uploadOutputToZephyr).toHaveBeenCalledTimes(1);
    expect(fastnode.logger.info).toHaveBeenCalledWith(
      "[zephyr-fastnode-preset] Zephyr deployment already done during build."
    );
  });
});
