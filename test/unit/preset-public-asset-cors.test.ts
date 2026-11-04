import { describe, expect, it, vi } from "vitest";
import type { Fastnode, FastnodeConfig, PublicAssetDir } from "fastnode/types";
import { normalizeRouteRules } from "../../src/config/resolver/route-rules.ts";
import { getPublicAssetCorsHeaders } from "../../src/presets/_utils/cors.ts";

const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "*" };

function createFastnode(
  routeRules: FastnodeConfig["routeRules"],
  publicAssets: Partial<PublicAssetDir>[] = [{ baseURL: "/build" }]
) {
  return {
    logger: { warn: vi.fn() },
    options: {
      baseURL: "/",
      routeRules: normalizeRouteRules({ routeRules }),
      publicAssets: publicAssets.map((dir) => ({ dir: "public", ...dir })),
    },
  } as unknown as Fastnode;
}

describe("getPublicAssetCorsHeaders", () => {
  it("adds the static headers of a matching `cors` rule", () => {
    expect(getPublicAssetCorsHeaders(createFastnode({ "/**": { cors: true } }))).toEqual([
      { base: "/build", headers: CORS },
    ]);
    expect(getPublicAssetCorsHeaders(createFastnode({ "/build/**": { cors: true } }))).toEqual([
      { base: "/build", headers: CORS },
    ]);
  });

  it("matches named catch-all rules, and not rules for the dir path only", () => {
    for (const rules of [
      { "/**:path": { cors: true } },
      { "/build/**:file": { cors: true } },
      { "/**": { cors: true }, "/build": { cors: false } },
    ] as FastnodeConfig["routeRules"][]) {
      const fastnode = createFastnode(rules);
      expect(getPublicAssetCorsHeaders(fastnode)).toEqual([{ base: "/build", headers: CORS }]);
      expect(fastnode.logger.warn).not.toHaveBeenCalled();
    }
  });

  it("skips fallthrough and root dirs, and dirs without `cors`", () => {
    const fastnode = createFastnode({ "/**": { cors: true } }, [
      { baseURL: "/" },
      {},
      { baseURL: "/build", fallthrough: true },
    ]);
    expect(getPublicAssetCorsHeaders(fastnode)).toEqual([]);
    expect(getPublicAssetCorsHeaders(createFastnode({ "/api/**": { cors: true } }))).toEqual([]);
  });

  it("merges rules like the runtime does", () => {
    expect(
      getPublicAssetCorsHeaders(
        createFastnode({
          "/**": { cors: { exposeHeaders: ["x-a"] } },
          "/build/**": { cors: { maxAge: "60" } },
        })
      )
    ).toEqual([
      {
        base: "/build",
        headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "x-a" },
      },
    ]);
    expect(
      getPublicAssetCorsHeaders(
        createFastnode({ "/**": { cors: true }, "/build/**": { cors: false } })
      )
    ).toEqual([]);
  });

  it("skips origin allowlists with a warning", () => {
    const fastnode = createFastnode({
      "/**": { cors: { origin: ["https://fastnode.khulnasoft.com"] } },
    });
    expect(getPublicAssetCorsHeaders(fastnode)).toEqual([]);
    expect(fastnode.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/`\/build`.*origins/));
  });

  it("skips dirs where a rule sets another `cors` for some files only", () => {
    const cases: FastnodeConfig["routeRules"][] = [
      { "/build/private/**": { cors: false } },
      { "/build/*.js": { cors: { origin: ["https://fastnode.khulnasoft.com"] } } },
      { "GET /build/**": { cors: false } },
    ];
    for (const rules of cases) {
      const fastnode = createFastnode({ "/**": { cors: true }, ...rules });
      expect(getPublicAssetCorsHeaders(fastnode)).toEqual([]);
      expect(fastnode.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`\`${Object.keys(rules!)[0]}\``)
      );
    }
    const fastnode = createFastnode({ "/**": { cors: true }, "/build/fonts/**": { cors: true } });
    expect(getPublicAssetCorsHeaders(fastnode)).toEqual([{ base: "/build", headers: CORS }]);
    expect(fastnode.logger.warn).not.toHaveBeenCalled();
  });

  it("skips dirs where a rule sets a CORS header for some files only", () => {
    for (const key of ["/build/fonts/**", "GET /build/**"]) {
      const fastnode = createFastnode({
        "/**": { cors: true },
        [key]: { headers: { "access-control-allow-origin": "https://fastnode.khulnasoft.com" } },
      });
      expect(getPublicAssetCorsHeaders(fastnode)).toEqual([]);
      expect(fastnode.logger.warn).toHaveBeenCalledWith(expect.stringContaining(`\`${key}\``));
    }
    const fastnode = createFastnode({
      "/**": { cors: true },
      "/build/fonts/**": { headers: { "x-fonts": "1" } },
    });
    expect(getPublicAssetCorsHeaders(fastnode)).toEqual([{ base: "/build", headers: CORS }]);
  });

  it("leaves headers set with `headers` to their rule", () => {
    expect(
      getPublicAssetCorsHeaders(
        createFastnode({
          "/**": { cors: true },
          "/build/**": {
            headers: { "Access-Control-Allow-Origin": "https://fastnode.khulnasoft.com" },
          },
        })
      )
    ).toEqual([{ base: "/build", headers: { "access-control-expose-headers": "*" } }]);
  });

  it("leaves headers set in the user's `_headers` file to it", () => {
    const fastnode = createFastnode({ "/**": { cors: true } });
    const corsFor = (headersFile: string) => getPublicAssetCorsHeaders(fastnode, { headersFile });
    expect(
      corsFor("/build/*\n  Access-Control-Allow-Origin: https://fastnode.khulnasoft.com\n")
    ).toEqual([{ base: "/build", headers: { "access-control-expose-headers": "*" } }]);
    expect(corsFor("/*\n  ! Access-Control-Expose-Headers\n")).toEqual([
      { base: "/build", headers: { "access-control-allow-origin": "*" } },
    ]);
    expect(
      corsFor(
        "/api/*\n  access-control-allow-origin: https://fastnode.khulnasoft.com\n  # access-control-expose-headers: x\n"
      )
    ).toEqual([{ base: "/build", headers: CORS }]);
  });

  it("covers nested dirs and dirs with the same base once", () => {
    const fastnode = createFastnode({ "/**": { cors: true } }, [
      { baseURL: "/build/fonts" },
      { baseURL: "/build" },
      { dir: "other", baseURL: "/build" },
    ]);
    expect(getPublicAssetCorsHeaders(fastnode)).toEqual([{ base: "/build", headers: CORS }]);
  });
});
