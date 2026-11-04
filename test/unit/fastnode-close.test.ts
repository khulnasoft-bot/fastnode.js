import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFastnode } from "../../src/builder.ts";

describe("fastnode.close()", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await realpath(await mkdtemp(join(tmpdir(), "fastnode-close-")));
    await writeFile(join(rootDir, "package.json"), JSON.stringify({ type: "module" }));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("runs `close` hooks once", async () => {
    let calls = 0;
    const fastnode = await createFastnode({
      rootDir,
      preset: "node-server",
      compatibilityDate: "2025-01-01",
      logLevel: 0,
      hooks: { close: () => void calls++ },
    });
    await Promise.all([fastnode.close(), fastnode.close()]);
    await fastnode.close();
    expect(calls).toBe(1);
  });
});
