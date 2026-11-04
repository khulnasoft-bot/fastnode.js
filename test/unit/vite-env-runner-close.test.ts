import type { FastnodePluginContext } from "../../src/build/builders/vite/types.ts";
import { describe, expect, it } from "vitest";
import { closeEnvRunner, initEnvRunner } from "../../src/build/builders/vite/env.ts";

describe("vite: closeEnvRunner", () => {
  it("does not throw when the runner failed to start", async () => {
    const initPromise = Promise.reject(new Error("failed to start"));
    initPromise.catch(() => {});
    const ctx = { _initPromise: initPromise } as unknown as FastnodePluginContext;
    await expect(closeEnvRunner(ctx)).resolves.toBeUndefined();
  });

  it("does not start a runner after close", async () => {
    const ctx = {} as FastnodePluginContext;
    await closeEnvRunner(ctx);
    await expect(initEnvRunner(ctx)).rejects.toThrow(/closed/);
    expect(ctx._initPromise).toBeUndefined();
  });
});
