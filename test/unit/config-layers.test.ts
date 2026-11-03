import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("#fastnode/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

// https://github.com/khulnasoft/fastnode/issues/4771
const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function createTempDir() {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "fastnode-config-layers-")));
  tempDirs.push(dir);
  return dir;
}

describe("config loader layers", () => {
  it("exposes root and extended layers without presets", async () => {
    const rootDir = await createTempDir();
    const baseDir = join(rootDir, "layers/base");
    await mkdir(baseDir, { recursive: true });

    await writeFile(
      join(rootDir, "fastnode.config.ts"),
      `export default defineFastnodeConfig({
  preset: 'node-server',
  extends: ['./layers/base', './shared.config'],
  $meta: { name: 'app' },
  routeRules: { '/root': { headers: { 'x-layer': 'root' } } },
})
`
    );
    await writeFile(
      join(baseDir, "fastnode.config.ts"),
      `export default defineFastnodeConfig({
  $meta: { name: 'base' },
  serverDir: './server',
  $production: { routeRules: { '/base': { headers: { 'x-layer': 'base' } } } },
})
`
    );
    await writeFile(
      join(rootDir, "shared.config.ts"),
      `export default defineFastnodeConfig({ routeRules: { '/shared': { redirect: '/' } } })\n`
    );

    const { loadOptions } = await import("../../src/config/loader.ts");
    const options = await loadOptions({ rootDir, dev: false }, { dotenv: false });

    expect(options.layers.map((layer) => [layer.cwd, layer.configFile, layer.meta?.name])).toEqual([
      [rootDir, join(rootDir, "fastnode.config.ts"), "app"],
      [baseDir, join(baseDir, "fastnode.config.ts"), "base"],
      [rootDir, join(rootDir, "shared.config.ts"), undefined],
    ]);
    expect(options.layers[0]!.config.routeRules).toHaveProperty("/root");
    expect(options.layers[1]!.config).toMatchObject({
      serverDir: "./server",
      routeRules: { "/base": { headers: { "x-layer": "base" } } },
    });
  });

  it("exposes the root layer without a config file", async () => {
    const rootDir = await createTempDir();

    const { loadOptions } = await import("../../src/config/loader.ts");
    const options = await loadOptions(
      { rootDir, dev: false, preset: "node-server" },
      { dotenv: false }
    );

    expect(options.layers).toEqual([
      { cwd: rootDir, configFile: undefined, config: {}, meta: undefined },
    ]);
  });
});
