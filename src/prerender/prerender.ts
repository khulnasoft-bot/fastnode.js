import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { defu } from "defu";
import mime from "mime";
import { isCaseInsensitiveFS, writeFile, prettyPath } from "../utils/fs.ts";
import type {
  Fastnode,
  NormalizedRouteRules,
  PrerenderRoute,
  PublicAssetDir,
} from "fastnode/types";
import { join, relative, resolve } from "pathe";
import { createRouter, addRoute, findAllRoutes } from "rou3";
import { joinURL, withBase, withoutBase, withTrailingSlash } from "ufo";
import { build } from "../build/build.ts";
import { resolveRolldown } from "../build/builders/rolldown/_import.ts";
import { viteDepPaths } from "../build/builders/vite/_import.ts";
import { createFastnode } from "../core/application/fastnode.ts";
import { compressPublicAssets } from "../utils/compress.ts";
import { runParallel } from "../utils/parallel.ts";
import { extractLinks, formatPrerenderRoute, matchesIgnorePattern } from "./utils.ts";
import { getPrerenderMeta } from "./_meta.ts";
import { scanUnprefixedPublicAssets } from "../build/assets.ts";
import { toRequest } from "h3";
import { EnvServer } from "env-runner";

const JsonSigRx = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/; // From unjs/destr

// const linkParents = new Map<string, Set<string>>();

export async function prerender(fastnode: Fastnode) {
  if (fastnode.options.noPublicDir) {
    fastnode.logger.warn("Skipping prerender since `noPublicDir` option is enabled.");
    return;
  }

  // Initial list of routes to prerender
  const routes = new Set(fastnode.options.prerender.routes);

  // Extend with static prerender route rules
  const prerenderRulePaths = Object.entries(fastnode.options.routeRules)
    .filter(([path, options]) => options.prerender && !path.includes("*"))
    .map((e) => e[0]);
  for (const route of prerenderRulePaths) {
    routes.add(route);
  }

  // Allow extending prerender routes
  await fastnode.hooks.callHook("prerender:routes", routes);

  // Skip if no prerender routes specified
  if (routes.size === 0) {
    // Crawl / at least if no routes are specified
    if (fastnode.options.prerender.crawlLinks) {
      routes.add("/");
    } else {
      return;
    }
  }

  // Build with prerender preset
  fastnode.logger.info("Initializing prerenderer");
  fastnode._prerenderedRoutes = [];
  const prerendererConfig = {
    ...fastnode.options._config,
    static: false,
    compressPublicAssets: false,
    rootDir: fastnode.options.rootDir,
    renderer: fastnode.options.renderer,
    virtual: { ...fastnode.options.virtual },
    logLevel: 0,
    preset: "fastnode-prerender",
    builder: prerenderBuilder(fastnode),
    deps: { ...fastnode.options.deps, paths: { ...viteDepPaths(fastnode) } },
  };
  await fastnode.hooks.callHook("prerender:config", prerendererConfig);
  const fastnodeRenderer = await createFastnode(prerendererConfig, {
    c12: { envName: [fastnode.options.envName, "prerender"] },
  });
  const prerenderStartTime = Date.now();
  await fastnode.hooks.callHook("prerender:init", fastnodeRenderer);
  await fastnodeRenderer.routing.sync();

  // Set path to preview prerendered routes relative to the "host" fastnode preset
  let path = relative(fastnode.options.output.dir, fastnode.options.output.publicDir);
  if (!path.startsWith(".")) {
    path = `./${path}`;
  }
  fastnodeRenderer.options.commands.preview = `npx serve ${path}`;
  fastnodeRenderer.options.output.dir = fastnode.options.output.dir;

  // Run prerender server in an isolate worker
  const prerenderer = await startPrerenderer(fastnodeRenderer);

  // Create route rule matcher
  const routeRules = createRouter<NormalizedRouteRules>();
  for (const [route, rules] of Object.entries(fastnode.options.routeRules)) {
    addRoute(routeRules, undefined, route, rules);
  }

  const _getRouteRules = (path: string) =>
    defu(
      {},
      ...findAllRoutes(routeRules, undefined, path)
        .map((r) => r.data)
        .reverse()
    ) as NormalizedRouteRules;

  // Start prerendering
  const generatedRoutes = new Set();
  // Original path of crawled links whose route (relative to `baseURL`) differs from it
  const crawledLinkPaths = new Map<string, string>();
  const failedRoutes = new Set<PrerenderRoute>();
  const skippedRoutes = new Set();
  const displayedLengthWarns = new Set();
  // Output path -> the route that produced it and a hash of its contents. Two routes
  // can resolve to one file (`/other` and `/other/index.html` both become
  // `other/index.html`), which is only known once each of them has been rendered.
  // Keyed by the resolved path rather than `fileName`, so aliases pointing at one
  // file still collide. On a case-insensitive filesystem, `/About` and `/about` are one
  // file too, so the key is lower-cased there.
  const outputByFile = new Map<string, { route: string; hash: string }>();
  const caseInsensitiveFS = await isCaseInsensitiveFS(fastnode.options.output.publicDir);
  const outputKey = (filePath: string) => (caseInsensitiveFS ? filePath.toLowerCase() : filePath);

  const publicAssetBases: string[] = fastnode.options.publicAssets
    .filter(
      (a): a is PublicAssetDir & { baseURL: string } =>
        !!a.baseURL && a.baseURL !== "/" && !a.fallthrough
    )
    .map((a) => withTrailingSlash(a.baseURL));

  const scannedPublicAssets = fastnode.options.prerender.ignoreUnprefixedPublicAssets
    ? new Set(await scanUnprefixedPublicAssets(fastnode))
    : new Set<string>();

  const canPrerender = (route = "/") => {
    // Skip if route is already generated or skipped
    if (generatedRoutes.has(route) || skippedRoutes.has(route)) {
      return false;
    }

    // Check for explicitly ignored routes
    if (fastnode.options.prerender.ignore) {
      for (const pattern of fastnode.options.prerender.ignore) {
        if (matchesIgnorePattern(route, pattern)) {
          return false;
        }
      }
    }

    if (publicAssetBases.some((base) => route.startsWith(base))) {
      return false;
    }

    if (scannedPublicAssets.has(route)) {
      return false;
    }

    // Check for route rules explicitly disabling prerender
    if (_getRouteRules(route).prerender === false) {
      return false;
    }

    return true;
  };

  const canWriteToDisk = (route: PrerenderRoute) => {
    // Cannot write routes with query or `..` segments
    if (route.route.includes("?") || route.route.split(/[/\\]/).includes("..")) {
      return false;
    }

    // Ensure length is not too long for filesystem
    // https://en.wikipedia.org/wiki/Comparison_of_file_systems#Limits
    const FS_MAX_SEGMENT = 255;
    // 1024 is the max path length on APFS (undocumented)
    const FS_MAX_PATH = 1024;
    const FS_MAX_PATH_PUBLIC_HTML = FS_MAX_PATH - (fastnode.options.output.publicDir.length + 10);

    if (
      (route.route.length >= FS_MAX_PATH_PUBLIC_HTML ||
        route.route.split("/").some((s) => s.length > FS_MAX_SEGMENT)) &&
      !displayedLengthWarns.has(route)
    ) {
      displayedLengthWarns.add(route);
      const _route = route.route.slice(0, 60) + "...";
      if (route.route.length >= FS_MAX_PATH_PUBLIC_HTML) {
        fastnode.logger.warn(
          `Prerendering long route "${_route}" (${route.route.length}) can cause filesystem issues since it exceeds ${FS_MAX_PATH_PUBLIC_HTML}-character limit when writing to \`${fastnode.options.output.publicDir}\`.`
        );
      } else {
        fastnode.logger.warn(
          `Skipping prerender of the route "${_route}" since it exceeds the ${FS_MAX_SEGMENT}-character limit in one of the path segments and can cause filesystem issues.`
        );
        return false;
      }
    }

    return true;
  };

  const generateRoute = async (route: string) => {
    const start = Date.now();

    // Crawled links are fetched, resolved and written by their original path
    const crawledPath = crawledLinkPaths.get(route);

    // Ensure route is decoded to start with
    route = decodeURI(route);
    const routePath = crawledPath ? decodeURI(crawledPath) : route;

    // Check if we should render route
    if (!canPrerender(route)) {
      skippedRoutes.add(route);
      return;
    }
    generatedRoutes.add(route);

    // Create result object
    const _route: PrerenderRoute = { route };

    // Fetch the route
    const encodedRoute = encodeURI(routePath);

    const req = toRequest(withBase(encodedRoute, fastnode.options.baseURL), {
      headers: [["x-fastnode-prerender", encodedRoute]],
    });
    const res = await prerenderer.fetch(req);
    // Data will be removed as soon as written to the disk
    let dataBuff: Buffer | undefined = Buffer.from(await res.arrayBuffer());

    Object.defineProperty(_route, "contents", {
      get: () => {
        return dataBuff ? dataBuff.toString("utf8") : undefined;
      },
      set(value: string) {
        // Only set if we didn't consume the buffer yet
        if (dataBuff) {
          dataBuff = Buffer.from(value);
        }
      },
    });
    Object.defineProperty(_route, "data", {
      get: () => {
        return dataBuff ? dataBuff.buffer : undefined;
      },
      set(value: string) {
        // Only set if we didn't consume the buffer yet
        if (dataBuff) {
          dataBuff = Buffer.from(value);
        }
      },
    });

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections
    const redirectCodes = [301, 302, 303, 304, 307, 308];
    if (![200, ...redirectCodes].includes(res.status)) {
      _route.error = new Error(`[${res.status}] ${res.statusText}`) as any;
      // @ts-expect-error (typed as readonly)
      _route.error!.status = res.status;
      // @ts-expect-error (typed as readonly)
      _route.error!.statusText = res.statusText;
    }

    // Measure actual time taken for generating route
    _route.generateTimeMS = Date.now() - start;

    // Guess route type and populate fileName
    const contentType = res.headers.get("content-type") || "";
    const isImplicitHTML =
      !routePath.endsWith(".html") &&
      contentType.includes("html") &&
      !JsonSigRx.test(dataBuff!.subarray(0, 32).toString("utf8"));
    const routeWithIndex = routePath.endsWith("/") ? routePath + "index" : routePath;
    const htmlPath =
      routePath.endsWith("/") || fastnode.options.prerender.autoSubfolderIndex
        ? joinURL(routePath, "index.html")
        : routePath + ".html";
    _route.fileName = withoutBase(
      isImplicitHTML ? htmlPath : routeWithIndex,
      fastnode.options.baseURL
    );
    // Allow overriding content-type in `prerender:generate` hook
    const inferredContentType = mime.getType(_route.fileName) || "text/plain";
    _route.contentType = contentType || inferredContentType;

    // Allow hooking before generate
    await fastnode.hooks.callHook("prerender:generate", _route, fastnode);
    const filePath = join(fastnode.options.output.publicDir, _route.fileName);
    const claimed = outputByFile.get(outputKey(filePath));
    // A route that cannot write to an already claimed file must not change its metadata
    if (_route.contentType !== inferredContentType && !claimed) {
      const prerenderMeta = getPrerenderMeta(fastnode);
      prerenderMeta[_route.fileName] ||= {};
      prerenderMeta[_route.fileName]!.contentType = _route.contentType;
    }

    // After hook to allow ignoring in `prerender:generate` hook
    if (_route.error) {
      failedRoutes.add(_route);
    }

    // Check if route is skipped or has errors
    if (_route.skip || _route.error) {
      await fastnode.hooks.callHook("prerender:route", _route);
      fastnode.logger.log(formatPrerenderRoute(_route));
      dataBuff = undefined; // Free memory
      return _route;
    }

    // Write to the disk
    if (claimed) {
      if (claimed.hash === hashContents(dataBuff!)) {
        // Same output (e.g. `/` and `/index.html` of an SPA): the file already holds it
        fastnode._prerenderedRoutes!.push(_route);
      } else {
        // Writing again would replace the first route's output with this one, so the
        // build result would depend on which of the two rendered first
        fastnode.logger.warn(
          `Routes \`${claimed.route}\` and \`${route}\` both prerender to \`${_route.fileName}\` with different contents. Keeping the output of \`${claimed.route}\`.`
        );
        _route.skip = true;
      }
    } else if (canWriteToDisk(_route) && filePath.startsWith(fastnode.options.output.publicDir)) {
      // Claim the file before awaiting, so a concurrent render of a route resolving
      // to the same file sees it as taken
      outputByFile.set(outputKey(filePath), { route, hash: hashContents(dataBuff!) });
      await writeFile(filePath, dataBuff!);
      fastnode._prerenderedRoutes!.push(_route);
    } else {
      _route.skip = true;
    }

    // Crawl route links
    if (!_route.error) {
      const crawlLinks =
        (fastnode.options.prerender.crawlLinks ?? false) &&
        (isImplicitHTML || routePath.endsWith(".html"));
      const extractedLinks = await extractLinks(
        crawlLinks ? dataBuff!.toString("utf8") : "",
        routePath,
        res,
        crawlLinks,
        fastnode.options.baseURL
      );
      for (const _link of extractedLinks) {
        // Crawled links include `baseURL`, while routes (and `ignore` patterns) are relative to it
        const link = withoutBase(_link, fastnode.options.baseURL);
        if (canPrerender(link) && !routes.has(link)) {
          if (link !== _link) {
            crawledLinkPaths.set(link, _link);
          }
          routes.add(link);
        }
      }
    }

    await fastnode.hooks.callHook("prerender:route", _route);
    fastnode.logger.log(formatPrerenderRoute(_route));

    dataBuff = undefined; // Free memory
    return _route;
  };

  fastnode.logger.info(
    fastnode.options.prerender.crawlLinks
      ? `Prerendering ${routes.size} initial routes with crawler`
      : `Prerendering ${routes.size} routes`
  );

  await runParallel(routes, generateRoute, {
    concurrency: fastnode.options.prerender.concurrency || 1,
    interval: fastnode.options.prerender.interval,
  });

  await prerenderer.close();

  await fastnode.hooks.callHook("prerender:done", {
    prerenderedRoutes: fastnode._prerenderedRoutes,
    failedRoutes: [...failedRoutes],
  });

  // Every route failed and nothing was written: fail regardless of `failOnError` (#4591)
  if (failedRoutes.size > 0 && fastnode._prerenderedRoutes.length === 0) {
    logPrerenderErrors(fastnode, failedRoutes);
    throw new Error(
      `Prerendered 0 routes. All ${failedRoutes.size} route(s) failed, so nothing was written to \`${prettyPath(fastnode.options.output.publicDir)}\`.` +
        missingRendererHint(fastnode)
    );
  }

  const ignoreStatusCodes = fastnode.options.prerender.ignoreStatusCodes || [];
  const fatalRoutes = new Set(
    [...failedRoutes].filter((route) => !ignoreStatusCodes.includes(route.error!.status!))
  );
  if (fastnode.options.prerender.failOnError && fatalRoutes.size > 0) {
    logPrerenderErrors(fastnode, fatalRoutes);
    throw new Error("Exiting due to prerender errors.");
  }

  const prerenderTimeInMs = Date.now() - prerenderStartTime;
  fastnode.logger.info(
    `Prerendered ${fastnode._prerenderedRoutes.length} routes in ${prerenderTimeInMs / 1000} seconds`
  );

  if (fastnode.options.compressPublicAssets) {
    await compressPublicAssets(fastnode);
  }
}

/** Builder of the prerenderer: `vite` builds use `rolldown` when installed, or run the sources. */
function prerenderBuilder(fastnode: Fastnode): Fastnode["options"]["builder"] {
  if (fastnode.options.builder === "vite") {
    return resolveRolldown(fastnode.options.rootDir, { paths: viteDepPaths(fastnode) })
      ? "rolldown"
      : false;
  }
  return fastnode.options.builder;
}

async function startPrerenderer(fastnodeRenderer: Fastnode): Promise<EnvServer> {
  const prerenderer = await createPrerenderer(fastnodeRenderer);
  // `fetch()` gives up on the worker after ~3s, so wait until it is ready before rendering
  // routes (allowing slow cold imports up to 60s). A worker failing to start closes its runner,
  // which fails the build right away.
  let onClose: ((runner: unknown, cause?: unknown) => void) | undefined;
  try {
    await Promise.race([
      prerenderer.waitForReady(60_000),
      new Promise<never>((_resolve, reject) => {
        onClose = (_runner, cause) =>
          reject(cause ?? new Error("Prerender worker closed before becoming ready"));
        prerenderer.onClose(onClose);
      }),
    ]);
  } catch (error) {
    await prerenderer.close();
    throw error;
  } finally {
    prerenderer.offClose(onClose!);
  }
  return prerenderer;
}

async function createPrerenderer(fastnodeRenderer: Fastnode): Promise<EnvServer> {
  if (fastnodeRenderer.options.builder === false) {
    const { startUnbundledPrerenderer } = await import("../build/builders/unbundled/prerender.ts");
    return startUnbundledPrerenderer(fastnodeRenderer);
  }

  await build(fastnodeRenderer);

  // Import renderer entry
  const serverFilename =
    typeof fastnodeRenderer.options.rollupConfig?.output?.entryFileNames === "string"
      ? fastnodeRenderer.options.rollupConfig.output.entryFileNames
      : "index.mjs";
  const serverEntrypoint = resolve(fastnodeRenderer.options.output.serverDir, serverFilename);

  return new EnvServer({
    runner: "node-worker",
    entry: serverEntrypoint,
  }).start();
}

function logPrerenderErrors(fastnode: Fastnode, failedRoutes: Set<PrerenderRoute>) {
  fastnode.logger.log("\nErrors prerendering:");
  for (const route of failedRoutes) {
    fastnode.logger.log(formatPrerenderRoute(route));
  }
  fastnode.logger.log("");
}

function missingRendererHint(fastnode: Fastnode): string {
  if (fastnode.options.renderer) {
    return "";
  }
  if (fastnode.options.builder === "vite") {
    return " No Vite SSR entry was detected. If the app renders HTML, place `entry-server` in `app/`, `src/` or the project root, or set `environments.ssr.build.rollupOptions.input` in the Vite config.";
  }
  return " No `renderer` is configured. Check that the app has a route or renderer able to serve the prerendered routes.";
}

function hashContents(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
