import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

// https://github.com/khulnasoft/fastnode/issues/4580
const ENV_KEY = "FASTNODE_TEST_APP_URL";
const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env[ENV_KEY];
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("config loader dotenv", () => {
  it("loads .env variables for route rules during build (non-dev)", async () => {
    delete process.env[ENV_KEY];
    const rootDir = await mkdtemp(join(tmpdir(), "fastnode-config-dotenv-"));
    tempDirs.push(rootDir);

    await writeFile(join(rootDir, ".env"), `${ENV_KEY}=https://example.com\n`);
    await writeFile(
      join(rootDir, "fastnode.config.ts"),
      `export default defineFastnodeConfig({
  preset: 'node-server',
  routeRules: {
    '/api/**': { headers: { 'x-app-url': process.env[${JSON.stringify(ENV_KEY)}] } }
  }
})
`
    );

    const { loadOptions } = await import("../../src/config/loader.ts");
    const options = await loadOptions({ rootDir, dev: false });

    expect(options.routeRules["/api/**"]?.headers).toMatchObject({
      "x-app-url": "https://example.com",
    });
  });
});
