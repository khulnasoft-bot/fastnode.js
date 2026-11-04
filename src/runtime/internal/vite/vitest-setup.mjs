import { beforeAll } from "vitest";

// `serverFetch` from `fastnode` reads the app from `globalThis.__fastnode__`: create it on first access.
// Deferred to `beforeAll` so Fastnode plugins are imported after the test file's `vi.mock` calls.
beforeAll(async () => {
  const { useFastnodeApp } = await import("fastnode/app");
  const registry = (globalThis.__fastnode__ ??= {});
  if (Object.hasOwn(registry, "default")) {
    return;
  }
  Object.defineProperty(registry, "default", {
    configurable: true,
    enumerable: true,
    get: () => useFastnodeApp(),
    set: (value) => {
      Object.defineProperty(registry, "default", {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    },
  });
});
