import fsp from "node:fs/promises";
import { writeFile } from "../_utils/fs.ts";
import type { Fastnode } from "fastnode/types";
import { join, resolve } from "pathe";

export async function writeSWARoutes(fastnode: Fastnode) {
  const host = {
    version: "2.0",
  };

  // https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v4#supported-versions
  const supportedNodeVersions = new Set(["20", "22"]);
  let nodeVersion = "22";
  try {
    const currentNodeVersion = JSON.parse(
      await fsp.readFile(join(fastnode.options.rootDir, "package.json"), "utf8")
    ).engines.node;
    if (supportedNodeVersions.has(currentNodeVersion)) {
      nodeVersion = currentNodeVersion;
    }
  } catch {
    const currentNodeVersion = process.versions.node.slice(0, 2);
    if (supportedNodeVersions.has(currentNodeVersion)) {
      nodeVersion = currentNodeVersion;
    }
  }

  // Merge custom config into the generated config
  const config = {
    ...fastnode.options.azure?.config,
    // Overwrite routes for now, we will add existing routes after generating routes
    routes: [] as Array<{ route: string; redirect?: string; rewrite?: string }>,
    platform: {
      apiRuntime: `node:${nodeVersion}`,
      ...fastnode.options.azure?.config?.platform,
    },
    navigationFallback: {
      rewrite: "/api/server",
      ...fastnode.options.azure?.config?.navigationFallback,
    },
  };

  const routeFiles = fastnode._prerenderedRoutes || [];

  const indexFileExists = routeFiles.some((route) => route.fileName === "/index.html");
  if (!indexFileExists) {
    config.routes.unshift(
      {
        route: "/index.html",
        redirect: "/",
      },
      {
        route: "/",
        rewrite: "/api/server",
      }
    );
  }

  const suffix = "/index.html".length;
  for (const { fileName } of routeFiles) {
    if (!fileName || !fileName.endsWith("/index.html")) {
      continue;
    }

    config.routes.unshift({
      route: fileName.slice(0, -suffix) || "/",
      rewrite: fileName,
    });
  }

  for (const { fileName } of routeFiles) {
    if (!fileName || !fileName.endsWith(".html") || fileName.endsWith("index.html")) {
      continue;
    }

    const route = fileName.slice(0, -".html".length);
    const existingRouteIndex = config.routes.findIndex((_route) => _route.route === route);
    if (existingRouteIndex !== -1) {
      config.routes.splice(existingRouteIndex, 1);
    }
    config.routes.unshift({
      route,
      rewrite: fileName,
    });
  }

  // Prepend custom routes to the beginning of the routes array and override if they exist
  if (
    fastnode.options.azure?.config &&
    "routes" in fastnode.options.azure.config &&
    Array.isArray(fastnode.options.azure.config.routes)
  ) {
    // We iterate through the reverse so the order in the custom config is persisted
    for (const customRoute of fastnode.options.azure.config.routes.reverse()) {
      const existingRouteMatchIndex = config.routes.findIndex(
        (value) => value.route === customRoute.route
      );

      if (existingRouteMatchIndex === -1) {
        // If we don't find a match, put the customRoute at the beginning of the array
        config.routes.unshift(customRoute);
      } else {
        // Otherwise override the existing route with our customRoute
        config.routes[existingRouteMatchIndex] = customRoute;
      }
    }
  }

  await writeFile(
    resolve(fastnode.options.output.serverDir, "../host.json"),
    JSON.stringify(host, null, 2)
  );
  await writeFile(
    resolve(fastnode.options.rootDir, "staticwebapp.config.json"),
    JSON.stringify(config, null, 2)
  );
  if (!indexFileExists) {
    const baseURLSegments = fastnode.options.baseURL.split("/").filter(Boolean);
    const relativePrefix = baseURLSegments.map(() => "..").join("/");
    await writeFile(
      resolve(
        fastnode.options.output.publicDir,
        relativePrefix ? `${relativePrefix}/index.html` : "index.html"
      ),
      ""
    );
  }
}
