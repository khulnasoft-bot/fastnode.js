import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { glob, readFile, rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createFastnode, build, prepare } from "fastnode/builder";

// #4171: a `require()` of an SSR external from bundled CommonJS must resolve to the copy Fastnode bundles
describe("vite: require of SSR externals", () => {
  const rootDir = fileURLToPath(new URL("./require-external-fixture", import.meta.url));
  const outDir = join(rootDir, ".tmp/output");

  it("build", async () => {
    await rm(outDir, { recursive: true, force: true });
    const fastnode = await createFastnode({
      rootDir,
      output: { dir: outDir },
      builder: "vite",
      // @ts-expect-error for testing
      __vitePkg__: process.env.FASTNODE_VITE_PKG,
    });
    await prepare(fastnode);
    await build(fastnode);
    await fastnode.close();
  });

  it("does not leave a runtime require in the output", async () => {
    for await (const file of glob("**/*.mjs", { cwd: join(outDir, "server") })) {
      const code = await readFile(join(outDir, "server", file), "utf8");
      expect(code, file).not.toContain(`require("@fixture/require-external-dep")`);
    }
  });

  it("shares a single instance of the dependency", async () => {
    const { fetch } = await import(join(outDir, "server/index.mjs")).then((m) => m.default);
    const res = await fetch(new Request("http://localhost/"));
    expect(await res.json()).toEqual({ sameInstance: true });
  });
});
