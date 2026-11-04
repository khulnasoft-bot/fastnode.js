import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { Fastnode } from "fastnode/types";
import { fastnode } from "../../src/vite.ts";

const { createBuilder, createServer } = (await import(
  process.env.FASTNODE_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite: service environments without a fastnode dependency", () => {
  let rootDir: string;
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    // Outside of the Fastnode package, so `selfEnv` aliases the `fastnode/*` exports
    // to this package's own files (the global CLI case).
    rootDir = mkdtempSync(join(tmpdir(), "fastnode-self-env-"));
    mkdirSync(join(rootDir, "app"), { recursive: true });
    writeFileSync(
      join(rootDir, "app/entry-server.ts"),
      `import { useKV } from "fastnode/kv";\nexport default { fetch: () => new Response(typeof useKV) };`
    );
    server = await createServer({
      root: rootDir,
      configFile: false,
      logLevel: "warn",
      plugins: [fastnode()],
    });
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  test("proxies `fastnode/*` in service environments", async () => {
    const entry = join(rootDir, "app/entry-server.ts");
    const resolved = await server.environments.ssr.pluginContainer.resolveId("fastnode/kv", entry);
    expect(resolved?.id).toBe("\0fastnode-env-proxy:fastnode/kv");
  });

  test("resolves `fastnode/*` self aliases in the fastnode environment", async () => {
    const entry = join(rootDir, "app/entry-server.ts");
    const resolved = await server.environments.fastnode.pluginContainer.resolveId(
      "fastnode/kv",
      entry
    );
    expect(resolved?.id).toMatch(/dist\/runtime\/kv\.mjs$/);
    expect(resolved?.id).not.toContain("\0fastnode-env-proxy:");
  });

  test("keeps `fastnode/*` self aliases in all environments with vitest", async () => {
    // Vitest has no dev service proxy, so test files in other environments rely on the aliases
    const vitestServer = await createServer({
      root: rootDir,
      configFile: false,
      logLevel: "warn",
      environments: { __vitest__: {} },
      plugins: [fastnode()],
    });
    try {
      const importer = join(rootDir, "test/kv.test.ts");
      const resolved = await vitestServer.environments.ssr.pluginContainer.resolveId(
        "fastnode/kv",
        importer
      );
      expect(resolved?.id).toMatch(/dist\/runtime\/kv\.mjs$/);
    } finally {
      await vitestServer.close();
    }
  });

  test("resolves `fastnode/*` self aliases in the production fastnode environment", async () => {
    let fastnodeInstance: Fastnode | undefined;
    const builder = await createBuilder({
      root: rootDir,
      configFile: false,
      logLevel: "warn",
      plugins: [fastnode({ hooks: { "build:before": (n) => void (fastnodeInstance = n) } })],
    });
    try {
      const alias = builder.environments.fastnode.config.resolve.alias || [];
      const kvAlias = alias.find((a) => typeof a.find === "string" && a.find === "fastnode/kv");
      expect(kvAlias?.replacement).toMatch(/dist\/runtime\/kv\.mjs$/);
    } finally {
      await fastnodeInstance?.close();
    }
  });
});
