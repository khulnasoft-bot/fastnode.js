import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Fastnode, FastnodeOptions } from "fastnode/types";

import { writeHeaders, writeRedirects } from "../../src/presets/netlify/utils.ts";
import {
  moveCFRedirects,
  writeCFHeaders,
  writeCFPagesRedirects,
} from "../../src/presets/cloudflare/utils.ts";
import { writeEdgeOneConfig } from "../../src/presets/edgeone/utils.ts";
import { isSplatExpressible, sortRoutes } from "../../src/presets/_utils/routes.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createFastnode(options: Partial<FastnodeOptions>) {
  const dir = await mkdtemp(join(tmpdir(), "fastnode-preset-route-config-"));
  dirs.push(dir);
  await mkdir(join(dir, "public"));
  const fastnode = {
    _prerenderedRoutes: [],
    scannedHandlers: [],
    routing: { sync: () => {}, routes: { routes: [] } },
    logger: { info: vi.fn(), warn: vi.fn() },
    options: {
      baseURL: "/",
      static: false,
      handlers: [],
      routeRules: {},
      publicAssets: [],
      // Resolved output dirs always end with a slash
      output: {
        dir: dir + "/",
        publicDir: join(dir, "public") + "/",
        serverDir: join(dir, "server") + "/",
      },
      ...options,
    },
  } as unknown as Fastnode;
  return { dir, fastnode };
}

// `_redirects` rules are matched in order, first match wins
const redirectSources = (contents: string) =>
  contents
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0]);

describe("netlify _redirects and _headers", () => {
  it("lists more specific redirects first", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/a/b": { redirect: { to: "/b", status: 302 } },
        "/a/:id": { redirect: { to: "/id", status: 302 } },
        "/a/**": { redirect: { to: "/all", status: 302 } },
      },
    });
    await writeRedirects(fastnode);
    const redirects = await readFile(join(dir, "public/_redirects"), "utf8");
    expect(redirectSources(redirects)).toEqual(["/a/b", "/a/:id", "/a/*"]);
  });

  it("converts named catch-all params to a splat", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/old/**:path": { redirect: { to: "/new/**", status: 302 } },
        "/hdr/**:path": { headers: { "x-hdr": "1" } },
      },
    });
    await writeRedirects(fastnode);
    await writeHeaders(fastnode);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/old/*\t/new/:splat\t302\n"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/hdr/*\n  x-hdr: 1\n");
  });

  it("prefixes sources with the baseURL and writes to the publish root", async () => {
    const { dir, fastnode } = await createFastnode({
      baseURL: "/base/",
      static: true,
      routeRules: {
        "/old/**": { redirect: { to: "/new/**", status: 301 } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    // Netlify presets output public assets to `dist/{{ baseURL }}`
    fastnode.options.output.publicDir = join(dir, "public/base") + "/";
    await mkdir(fastnode.options.output.publicDir);
    await writeFile(join(fastnode.options.output.publicDir, "404.html"), "");
    await writeRedirects(fastnode);
    await writeHeaders(fastnode);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/base/old/*\t/new/:splat\t301\n/base/* /base/404.html 404"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/base/hdr/*\n  x-hdr: 1\n");

    // Rebuilding does not merge the previous output again
    await writeRedirects(fastnode);
    await writeHeaders(fastnode);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/base/old/*\t/new/:splat\t301\n/base/* /base/404.html 404"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/base/hdr/*\n  x-hdr: 1\n");
  });

  it("moves user files from the baseURL dir to the publish root", async () => {
    const { dir, fastnode } = await createFastnode({
      baseURL: "/base/",
      routeRules: {
        "/old/**": { redirect: { to: "/new/**", status: 301 } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    fastnode.options.output.publicDir = join(dir, "public/base") + "/";
    await mkdir(fastnode.options.output.publicDir);
    await writeFile(join(fastnode.options.output.publicDir, "_redirects"), "/user /other 302");
    await writeFile(join(fastnode.options.output.publicDir, "_headers"), "/user\n  x-user: 1");
    await writeRedirects(fastnode);
    await writeHeaders(fastnode);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/user /other 302\n/base/old/*\t/new/:splat\t301\n"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe(
      "/user\n  x-user: 1\n/base/hdr/*\n  x-hdr: 1\n"
    );
    expect(existsSync(join(dir, "public/base/_redirects"))).toBe(false);
    expect(existsSync(join(dir, "public/base/_headers"))).toBe(false);
  });

  it("keeps a user fallback under the baseURL", async () => {
    const { dir, fastnode } = await createFastnode({
      baseURL: "/base/",
      routeRules: { "/old/**": { redirect: { to: "/new/**", status: 301 } } },
    });
    fastnode.options.output.publicDir = join(dir, "public/base") + "/";
    await mkdir(fastnode.options.output.publicDir);
    await writeFile(
      join(fastnode.options.output.publicDir, "_redirects"),
      "/base/* /base/index.html 200"
    );
    await writeRedirects(fastnode);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/base/* /base/index.html 200"
    );
  });

  it("writes to a custom publicDir that does not end with the baseURL", async () => {
    const { dir, fastnode } = await createFastnode({
      baseURL: "/app/",
      routeRules: { "/old/**": { redirect: { to: "/new/**", status: 301 } } },
    });
    await writeRedirects(fastnode);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/app/old/*\t/new/:splat\t301\n"
    );
    expect(existsSync(join(dir, "_redirects"))).toBe(false);
  });

  it("skips rules without headers", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/**": { cors: {}, headers: {} },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    await writeHeaders(fastnode);
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/hdr/*\n  x-hdr: 1\n");
  });

  it("adds the CORS headers of public asset dirs", async () => {
    const { dir, fastnode } = await createFastnode({
      baseURL: "/app/",
      routeRules: { "/**": { cors: {} } },
      publicAssets: [{ dir: "public", baseURL: "/build" }],
    });
    await writeHeaders(fastnode);
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe(
      "/app/build/*\n  access-control-allow-origin: *\n  access-control-expose-headers: *\n"
    );
  });

  it("keeps CORS headers of the user `_headers` for public asset dirs", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: { "/**": { cors: {} } },
      publicAssets: [{ dir: "public", baseURL: "/build" }],
    });
    const userHeaders =
      "/build/*\n  access-control-allow-origin: https://fastnode.khulnasoft.com\n";
    await writeFile(join(dir, "public/_headers"), userHeaders);
    await writeHeaders(fastnode);
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe(
      userHeaders + "\n/build/*\n  access-control-expose-headers: *\n"
    );
  });

  it("skips method-scoped rules with a warning", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "GET /old/**": { redirect: { to: "/new/**", status: 302 } },
        "/plain/**": { redirect: { to: "/other/**", status: 302 } },
        "GET /hdr/**": { headers: { "x-get": "1" } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    await writeRedirects(fastnode);
    await writeHeaders(fastnode);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/plain/*\t/other/:splat\t302\n"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/hdr/*\n  x-hdr: 1\n");
    expect(fastnode.logger.warn).toHaveBeenCalledTimes(2);
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`GET \/old\/\*\*`.*`_redirects`/)
    );
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`GET \/hdr\/\*\*`.*`_headers`/)
    );
  });

  it("skips redirects that would shadow a skipped method-scoped redirect", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/old/**": { redirect: { to: "/a/**", status: 302 } },
        "GET /old/**": { redirect: { to: "/b/**", status: 302 } },
        "/old/specific": { redirect: { to: "/sp", status: 302 } },
        "/s/**": { redirect: { to: "/t/**", status: 302 } },
        "GET /s/a": { redirect: { to: "/u", status: 302 } },
        "/keep/**": { redirect: { to: "/k/**", status: 302 } },
      },
    });
    await writeRedirects(fastnode);
    const redirects = await readFile(join(dir, "public/_redirects"), "utf8");
    expect(redirectSources(redirects).sort()).toEqual(["/keep/*", "/old/specific"]);
    expect(fastnode.logger.warn).toHaveBeenCalledTimes(4);
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/old\/\*\*`.*`GET \/old\/\*\*`/)
    );
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/s\/\*\*`.*`GET \/s\/a`/)
    );
  });
  it("skips route rules the splat syntax cannot express", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/ok/:id": { redirect: { to: "/id", status: 302 } },
        "/num/:id(\\d+)": { redirect: { to: "/num", status: 302 } },
        "/opt/:id?": { redirect: { to: "/opt", status: 302 } },
        "/ok/**": { headers: { "x-ok": "1" } },
        "/files/*.png": { headers: { "x-png": "1" } },
        "/a/**/b": { headers: { "x-ab": "1" } },
      },
    });
    await writeRedirects(fastnode);
    await writeHeaders(fastnode);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe("/ok/:id\t/id\t302\n");
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe(
      "/files/*.png\n  x-png: 1\n/ok/*\n  x-ok: 1\n"
    );
    expect(fastnode.logger.warn).toHaveBeenCalledTimes(3);
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/a\/\*\*\/b`.*`_headers`/)
    );
  });

  it("skips redirects that would shadow an unexpressible redirect", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/num/:id(\\d+)": { redirect: { to: "/n", status: 302 } },
        "/num/**": { redirect: { to: "/all", status: 302 } },
        "/keep/**": { redirect: { to: "/k", status: 302 } },
      },
    });
    await writeRedirects(fastnode);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe("/keep/*\t/k\t302\n");
    expect(fastnode.logger.warn).toHaveBeenCalledTimes(2);
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/num\/\*\*`.*`\/num\/:id\(\\d\+\)`/)
    );
  });
});

describe("cloudflare pages _redirects and _headers", () => {
  it("lists more specific redirects first", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/a/b": { redirect: { to: "/b", status: 302 } },
        "/a/:id": { redirect: { to: "/id", status: 302 } },
        "/a/**": { redirect: { to: "/all", status: 302 } },
      },
    });
    await writeCFPagesRedirects(fastnode);
    const redirects = await readFile(join(dir, "_redirects"), "utf8");
    expect(redirectSources(redirects)).toEqual(["/a/b", "/a/:id", "/a/*"]);
  });

  it("interpolates the splat into redirect targets", async () => {
    const { dir, fastnode } = await createFastnode({
      baseURL: "/base/",
      routeRules: {
        "/old/**:path": { redirect: { to: "/new/**", status: 301 } },
        "/ext/**": { redirect: { to: "https://fastnode.khulnasoft.com/**", status: 302 } },
        "/cdn/**": { redirect: { to: "//cdn.fastnode.khulnasoft.com/**", status: 302 } },
        "/hdr/**:path": { headers: { "x-hdr": "1" } },
      },
    });
    await writeCFPagesRedirects(fastnode);
    await writeCFHeaders(fastnode, "output");
    expect(await readFile(join(dir, "_redirects"), "utf8")).toBe(
      "/base/cdn/*\t//cdn.fastnode.khulnasoft.com/:splat\t302\n/base/ext/*\thttps://fastnode.khulnasoft.com/:splat\t302\n/base/old/*\t/new/:splat\t301\n"
    );
    expect(await readFile(join(dir, "_headers"), "utf8")).toBe("/base/hdr/*\n  x-hdr: 1");
  });

  it("skips rules without headers", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/**": { cors: {}, headers: {} },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    await writeCFHeaders(fastnode, "output");
    expect(await readFile(join(dir, "_headers"), "utf8")).toBe("/hdr/*\n  x-hdr: 1");
  });

  it("adds the CORS headers of public asset dirs", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: { "/**": { cors: {} }, "/hdr/**": { headers: { "x-hdr": "1" } } },
      publicAssets: [{ dir: "public", baseURL: "/build" }],
    });
    await writeCFHeaders(fastnode, "output");
    expect(await readFile(join(dir, "_headers"), "utf8")).toBe(
      "/hdr/*\n  x-hdr: 1\n/build/*\n  access-control-allow-origin: *\n  access-control-expose-headers: *"
    );
  });

  it("keeps CORS headers of the user `_headers` for public asset dirs", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: { "/**": { cors: {} } },
      publicAssets: [{ dir: "public", baseURL: "/build" }],
    });
    const userHeaders = "/build/*\n  access-control-allow-origin: https://fastnode.khulnasoft.com";
    await writeFile(join(dir, "_headers"), userHeaders);
    await writeCFHeaders(fastnode, "output");
    expect(await readFile(join(dir, "_headers"), "utf8")).toBe(
      userHeaders + "\n/build/*\n  access-control-expose-headers: *"
    );
  });

  it("skips method-scoped rules with a warning", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "GET /old/**": { redirect: { to: "/new/**", status: 302 } },
        "/plain/**": { redirect: { to: "/other/**", status: 302 } },
        "GET /hdr/**": { headers: { "x-get": "1" } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    await writeCFPagesRedirects(fastnode);
    await writeCFHeaders(fastnode, "output");
    expect(await readFile(join(dir, "_redirects"), "utf8")).toBe("/plain/*\t/other/:splat\t302\n");
    expect(await readFile(join(dir, "_headers"), "utf8")).toBe("/hdr/*\n  x-hdr: 1");
    expect(fastnode.logger.warn).toHaveBeenCalledTimes(2);
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`GET \/old\/\*\*`.*`_redirects`/)
    );
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`GET \/hdr\/\*\*`.*`_headers`/)
    );
  });

  it("skips redirects that would shadow a skipped method-scoped redirect", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/old/**": { redirect: { to: "/a/**", status: 302 } },
        "GET /old/**": { redirect: { to: "/b/**", status: 302 } },
        "/old/specific": { redirect: { to: "/sp", status: 302 } },
        "/s/**": { redirect: { to: "/t/**", status: 302 } },
        "GET /s/a": { redirect: { to: "/u", status: 302 } },
        "/keep/**": { redirect: { to: "/k/**", status: 302 } },
      },
    });
    await writeCFPagesRedirects(fastnode);
    const redirects = await readFile(join(dir, "_redirects"), "utf8");
    expect(redirectSources(redirects).sort()).toEqual(["/keep/*", "/old/specific"]);
    expect(fastnode.logger.warn).toHaveBeenCalledTimes(4);
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/old\/\*\*`.*`GET \/old\/\*\*`/)
    );
    expect(fastnode.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/s\/\*\*`.*`GET \/s\/a`/)
    );
  });
  it("skips route rules the splat syntax cannot express", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: {
        "/ok/:id": { redirect: { to: "/id", status: 302 } },
        "/num/:id(\\d+)": { redirect: { to: "/num", status: 302 } },
        "/files/*.png": { redirect: { to: "/png", status: 302 } },
        "/ok/**": { headers: { "x-ok": "1" } },
        "/a/:id/*.png": { headers: { "x-png": "1" } },
        "/a/**/b": { headers: { "x-ab": "1" } },
      },
    });
    await writeCFPagesRedirects(fastnode);
    await writeCFHeaders(fastnode, "output");
    expect(await readFile(join(dir, "_redirects"), "utf8")).toBe("/ok/:id\t/id\t302\n");
    expect(await readFile(join(dir, "_headers"), "utf8")).toBe(
      "/a/:id/*.png\n  x-png: 1\n/ok/*\n  x-ok: 1"
    );
    expect(fastnode.logger.warn).toHaveBeenCalledTimes(3);
  });
});

describe("cloudflare workers _headers and _redirects", () => {
  it("writes `_headers` to the assets root and moves user files from the baseURL dir", async () => {
    const { dir, fastnode } = await createFastnode({
      baseURL: "/base/",
      routeRules: { "/hdr/**": { headers: { "x-hdr": "1" } } },
    });
    // Resolved output paths end with a slash
    fastnode.options.output.publicDir = join(dir, "public/base") + "/";
    await mkdir(fastnode.options.output.publicDir);
    await writeFile(join(fastnode.options.output.publicDir, "_headers"), "/user\n  x-user: 1");
    await writeFile(join(fastnode.options.output.publicDir, "_redirects"), "/user /other 302");
    await writeCFHeaders(fastnode, "assets");
    await moveCFRedirects(fastnode);
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe(
      "/user\n  x-user: 1\n/base/hdr/*\n  x-hdr: 1"
    );
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe("/user /other 302");
    expect(existsSync(join(dir, "public/base/_headers"))).toBe(false);
    expect(existsSync(join(dir, "public/base/_redirects"))).toBe(false);
  });

  it("keeps a user `_headers` with a fallback as is", async () => {
    const { dir, fastnode } = await createFastnode({
      baseURL: "/base/",
      routeRules: { "/hdr/**": { headers: { "x-hdr": "1" } } },
    });
    fastnode.options.output.publicDir = join(dir, "public/base") + "/";
    await mkdir(fastnode.options.output.publicDir);
    await writeFile(join(fastnode.options.output.publicDir, "_headers"), "/* \n  x-all: 1");
    await writeCFHeaders(fastnode, "assets");
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/* \n  x-all: 1");
    expect(existsSync(join(dir, "public/base/_headers"))).toBe(false);
  });

  it("writes to the public dir without a baseURL", async () => {
    const { dir, fastnode } = await createFastnode({
      routeRules: { "/hdr/**": { headers: { "x-hdr": "1" } } },
    });
    await writeFile(join(dir, "public/_redirects"), "/user /other 302");
    await writeCFHeaders(fastnode, "assets");
    await moveCFRedirects(fastnode);
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/hdr/*\n  x-hdr: 1");
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe("/user /other 302");
  });
});

describe("isSplatExpressible", () => {
  it.each([
    ["/a/b", true, true],
    ["/a/:id", true, true],
    ["/a/:id_2", true, true],
    ["/a/**", true, true],
    ["/a/**:path", true, true],
    ["/a/*", true, true],
    ["/files/*.png", false, true],
    ["/a/*/b", false, true],
    ["/a/:id/*.png", false, true],
    ["/a/:_id", false, false],
    ["/a/:2nd", false, false],
    ["/a/:id(\\d+)", false, false],
    ["/a/:id?", false, false],
    ["/a/:x+", false, false],
    ["/a/:x*", false, false],
    ["/a/{b}?", false, false],
    ["/a/**/b", false, false],
  ])("%s -> _redirects: %s, _headers: %s", (route, redirects, headers) => {
    expect(isSplatExpressible(route, { file: "_redirects" })).toBe(redirects);
    expect(isSplatExpressible(route, { file: "_headers" })).toBe(headers);
  });
});

describe("edgeone config.json", () => {
  type Route = {
    src?: string;
    status?: number;
    headers?: Record<string, string>;
    methods?: string[];
    continue?: boolean;
  };

  async function buildRoutes(options: Partial<FastnodeOptions>): Promise<Route[]> {
    const { dir, fastnode } = await createFastnode(options);
    await writeEdgeOneConfig(fastnode);
    return JSON.parse(await readFile(join(dir, "server/config.json"), "utf8")).routes;
  }

  // EdgeOne stops at the first matching route that does not `continue`
  const firstMatch = (routes: Route[], path: string) =>
    routes.find((r) => r.src && !r.continue && new RegExp(r.src).test(path));
  const headersFor = (routes: Route[], path: string) =>
    routes
      .filter((r) => r.src && r.headers && new RegExp(r.src).test(path))
      .reduce((headers, r) => ({ ...headers, ...r.headers }), {});

  it("matches route rules like the runtime does", async () => {
    const routes = await buildRoutes({
      baseURL: "/base/",
      routeRules: {
        "/file.json": { headers: { "x-file": "1" } },
        "/docs/**": { headers: { "x-docs": "1" } },
        "/single/*": { headers: { "x-single": "1" } },
      },
    });
    expect(headersFor(routes, "/base/file.json")).toEqual({ "x-file": "1" });
    expect(headersFor(routes, "/base/fileXjson")).toEqual({});
    expect(headersFor(routes, "/base/docs")).toEqual({ "x-docs": "1" });
    expect(headersFor(routes, "/base/docs/a/b")).toEqual({ "x-docs": "1" });
    expect(headersFor(routes, "/base/single/a/b")).toEqual({ "x-single": "1" });
  });

  it("skips rules without headers", async () => {
    const routes = await buildRoutes({
      routeRules: {
        "/**": { cors: {}, headers: {} },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    expect(routes.filter((r) => r.headers && Object.keys(r.headers).length === 0)).toEqual([]);
    expect(headersFor(routes, "/hdr/a")).toEqual({ "x-hdr": "1" });
  });

  it("adds the CORS headers of public asset dirs", async () => {
    const routes = await buildRoutes({
      baseURL: "/base/",
      routeRules: { "/**": { cors: {} } },
      publicAssets: [{ dir: "public", baseURL: "/build" }],
    });
    expect(headersFor(routes, "/base/build/a.js")).toEqual({
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "*",
    });
    expect(headersFor(routes, "/base/buildings")).toEqual({});
  });

  it("matches the most specific redirect first", async () => {
    const routes = await buildRoutes({
      routeRules: {
        "/r/**": { redirect: { to: "/all/**", status: 302 } },
        "/r/special": { redirect: { to: "/special", status: 301 } },
        "/ext/**": { redirect: { to: "https://fastnode.khulnasoft.com/**", status: 302 } },
      },
    });
    expect(firstMatch(routes, "/r/special")?.headers?.Location).toBe("/special");
    const catchAll = firstMatch(routes, "/r/a/b")!;
    expect("/r/a/b".replace(new RegExp(catchAll.src!), catchAll.headers!.Location)).toBe(
      "/all/a/b"
    );
    const external = firstMatch(routes, "/ext/a")!;
    expect("/ext/a".replace(new RegExp(external.src!), external.headers!.Location)).toBe(
      "https://fastnode.khulnasoft.com/a"
    );
  });

  it("uses redirect targets as written with a baseURL", async () => {
    const routes = await buildRoutes({
      baseURL: "/base/",
      routeRules: {
        "/r/**": { redirect: { to: "/all/**", status: 302 } },
        "/r/special": { redirect: { to: "/special", status: 301 } },
        "/ext/**": { redirect: { to: "https://fastnode.khulnasoft.com/**", status: 302 } },
        "/cdn/**": { redirect: { to: "//cdn.fastnode.khulnasoft.com/**", status: 302 } },
      },
    });
    const resolve = (path: string) => {
      const route = firstMatch(routes, path)!;
      return path.replace(new RegExp(route.src!), route.headers!.Location);
    };
    expect(firstMatch(routes, "/base/r/special")?.headers?.Location).toBe("/special");
    expect(resolve("/base/r/a/b")).toBe("/all/a/b");
    expect(resolve("/base/ext/a")).toBe("https://fastnode.khulnasoft.com/a");
    expect(resolve("/base/cdn/a")).toBe("//cdn.fastnode.khulnasoft.com/a");
  });

  it("scopes method-scoped rules to their methods", async () => {
    const routes = await buildRoutes({
      routeRules: {
        "GET /old/**": { redirect: { to: "/new/**", status: 302 } },
        "POST /form": { redirect: { to: "/thanks", status: 303 } },
        "/old/**": { redirect: { to: "/all", status: 302 } },
        "GET /hdr/**": { headers: { "x-get": "1" } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    const matches = (path: string) =>
      routes.filter((r) => r.src && !r.continue && new RegExp(r.src).test(path));
    expect(matches("/old/a").map((r) => [r.methods, r.headers?.Location])).toEqual([
      [["GET", "HEAD"], "/new/$1"],
      [undefined, "/all"],
      [undefined, undefined],
    ]);
    expect(matches("/form")[0]).toMatchObject({ methods: ["POST"], status: 303 });
    expect(
      routes.filter((r) => r.headers && r.continue && new RegExp(r.src!).test("/hdr/a"))
    ).toEqual([
      expect.objectContaining({ headers: { "x-hdr": "1" } }),
      expect.objectContaining({ headers: { "x-get": "1" }, methods: ["GET", "HEAD"] }),
    ]);
  });
});

describe("sortRoutes", () => {
  it("ranks method-scoped keys by their path", () => {
    expect(sortRoutes(["/a/**", "GET /a/**", "POST /a/b", "/**"])).toEqual([
      "POST /a/b",
      "GET /a/**",
      "/a/**",
      "/**",
    ]);
  });

  it("ranks HEAD before GET for the same path", () => {
    expect(sortRoutes(["HEAD /a", "/a", "GET /a"])).toEqual(["HEAD /a", "GET /a", "/a"]);
  });
});
