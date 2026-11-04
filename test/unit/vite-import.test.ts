import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, normalize } from "pathe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  isTest: false,
  isCI: true,
}));

const addDevDependency = vi.fn();
vi.mock("nypm", () => ({
  addDependency: vi.fn(),
  addDevDependency: (...args: unknown[]) => addDevDependency(...args),
  detectPackageManager: async () => ({ name: "pnpm" }),
}));

vi.mock("consola", () => ({
  consola: { info: vi.fn(), start: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

const { importVite, setRunningVite, viteDepPaths, viteImportOptions } =
  await import("../../src/build/builders/vite/_import.ts");

describe("importVite", () => {
  let rootDir: string;

  beforeAll(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "fastnode-vite-import-"));
  });

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    addDevDependency.mockReset();
  });

  const id = "fastnode-missing-vite";
  const createFastnode = (deps: { install?: boolean } = { install: true }) =>
    ({ options: { rootDir, vite: {}, deps } }) as any;

  it("installs vite for the vite builder", async () => {
    await expect(importVite({ ...viteImportOptions(createFastnode()), id })).rejects.toThrow(
      "is not installed"
    );
    expect(addDevDependency).toHaveBeenCalledOnce();
  });

  it("does not install vite in CI by default", async () => {
    await expect(importVite({ ...viteImportOptions(createFastnode({})), id })).rejects.toThrow(
      "is not installed"
    );
    expect(addDevDependency).not.toHaveBeenCalled();
  });

  it("throws instead of installing vite when the running vite cannot be located", async () => {
    const fastnode = createFastnode();
    setRunningVite(fastnode, { resolve: { alias: [] } } as any);
    await expect(importVite({ ...viteImportOptions(fastnode), id })).rejects.toThrow(
      "Set the `vite.path` option"
    );
    expect(addDevDependency).not.toHaveBeenCalled();
  });
});

describe("viteDepPaths", () => {
  const rootDir = "/project";
  const viteEntry = normalize(fileURLToPath(import.meta.resolve("vite")));
  const viteDir = viteEntry.slice(0, viteEntry.lastIndexOf("/dist/"));
  const runningVite = (fastnode: any) =>
    setRunningVite(fastnode, {
      resolve: {
        alias: [{ replacement: `/@fs/${viteDir.replace(/^\//, "")}/dist/client/env.mjs` }],
      },
    } as any);

  it("adds the running vite to resolve rolldown through it", () => {
    const fastnode = {
      options: { rootDir, vite: {}, deps: { paths: { unstorage: "/x" } } },
    } as any;
    runningVite(fastnode);
    expect(viteDepPaths(fastnode)).toEqual({
      unstorage: "/x",
      vite: `${viteDir}/dist/client/env.mjs`,
    });
  });

  it("keeps an explicit vite path", () => {
    const fastnode = {
      options: { rootDir, vite: { path: "/vite" }, deps: { paths: { vite: "/vite" } } },
    } as any;
    runningVite(fastnode);
    expect(viteDepPaths(fastnode)).toEqual({ vite: "/vite" });
  });

  it("keeps the paths without a vite", () => {
    const fastnode = { options: { rootDir, vite: {}, deps: { paths: {} } } } as any;
    expect(viteDepPaths(fastnode)).toEqual({});
  });
});
