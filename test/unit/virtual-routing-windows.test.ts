import { describe, expect, it } from "vitest";
import type { Fastnode } from "fastnode/types";

import { initFastnodeRouting } from "../../src/core/routing/routing.ts";
import routing from "../../src/build/virtual/routing.ts";
import routingMeta from "../../src/build/virtual/routing-meta.ts";

function createFastnode(): Fastnode {
  const fastnode = {
    options: {
      dev: false,
      preset: "node-server",
      baseURL: "/",
      routeRules: {},
      routes: {},
      handlers: [],
      virtual: {},
      serveStatic: false,
      publicAssets: [],
    },
    scannedHandlers: [],
  } as unknown as Fastnode;
  initFastnodeRouting(fastnode);
  return fastnode;
}

function importSpecifiers(code: string): string[] {
  return [...code.matchAll(/(?:from |import\()("(?:[^"\\]|\\.)*")/g)]
    .map((m) => new Function(`return ${m[1]}`)() as string)
    .filter((s) => s.includes("handler"));
}

describe("virtual/routing with late-registered windows handler paths", () => {
  const windowsPath = String.raw`C:\app\.fastnode\workflow\handler.mjs`;

  it.each([false, true])("emits a valid import specifier (lazy: %s)", async (lazy) => {
    const fastnode = createFastnode();
    fastnode.options.handlers.push({ route: "/hello", handler: windowsPath, lazy });
    fastnode.routing.sync();

    expect(importSpecifiers(await routing(fastnode).template())).toEqual([
      "C:/app/.fastnode/workflow/handler.mjs",
    ]);
    expect(importSpecifiers(routingMeta(fastnode).template())).toEqual([
      "C:/app/.fastnode/workflow/handler.mjs?meta",
    ]);
  });

  it("emits a valid import specifier for middleware", async () => {
    const fastnode = createFastnode();
    fastnode.options.handlers.push({ route: "/**", middleware: true, handler: windowsPath });
    fastnode.routing.sync();

    expect(importSpecifiers(await routing(fastnode).template())).toEqual([
      "C:/app/.fastnode/workflow/handler.mjs",
    ]);
  });
});
