import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FastnodeConfig } from "fastnode/types";
import { createFastnode } from "../../src/core/application/fastnode.ts";
import { getRollupConfig } from "../../src/build/builders/rollup/config.ts";
import { getBundlerConfig } from "../../src/build/builders/vite/bundler.ts";
import type { FastnodePluginContext } from "../../src/build/builders/vite/types.ts";

const fastnodeFor = (config?: FastnodeConfig) =>
  createFastnode({
    rootDir: mkdtempSync(join(tmpdir(), "fastnode-import-attributes-")),
    compatibilityDate: "latest",
    ...config,
  });

const viteRollupOutput = async (config?: FastnodeConfig) => {
  const fastnode = await fastnodeFor(config);
  const { rollupConfig } = await getBundlerConfig({
    fastnode,
    _isRolldown: false,
  } as unknown as FastnodePluginContext);
  return rollupConfig!.output!;
};

// Rollup 4 defaults to `assert`, which Node.js removed in v22.
describe("import attributes", () => {
  it("emits external imports with the `with` key", async () => {
    const { output } = await getRollupConfig(await fastnodeFor());
    expect((output as { importAttributesKey?: string }).importAttributesKey).toBe("with");
  });

  it("uses the same key in the vite builder's rollup output", async () => {
    expect((await viteRollupOutput()).importAttributesKey).toBe("with");
  });

  it("keeps an explicit key from user config", async () => {
    const userConfig: FastnodeConfig = {
      rollupConfig: { output: { importAttributesKey: "assert" } },
    };
    const { output } = await getRollupConfig(await fastnodeFor(userConfig));
    expect((output as { importAttributesKey?: string }).importAttributesKey).toBe("assert");
    expect((await viteRollupOutput(userConfig)).importAttributesKey).toBe("assert");
  });
});
