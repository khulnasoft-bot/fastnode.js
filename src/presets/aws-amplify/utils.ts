import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Fastnode } from "fastnode/types";
import { joinURL } from "ufo";
import type { AmplifyDeployManifest, AmplifyRoute, AmplifyRouteTarget } from "./types.ts";

export async function writeAmplifyFiles(fastnode: Fastnode) {
  const outDir = fastnode.options.output.dir;

  // Generate routes
  const routes: AmplifyRoute[] = [];

  let hasWildcardPublicAsset = false;

  if (fastnode.options.awsAmplify?.imageOptimization && !fastnode.options.static) {
    const { path, cacheControl } = fastnode.options.awsAmplify?.imageOptimization || {};
    if (path) {
      routes.push({
        path,
        target: {
          kind: "ImageOptimization",
          cacheControl,
        },
      });
    }
  }

  const computeTarget: AmplifyRouteTarget = fastnode.options.static
    ? { kind: "Static" }
    : { kind: "Compute", src: "default" };

  for (const publicAsset of fastnode.options.publicAssets) {
    if (!publicAsset.baseURL || publicAsset.baseURL === "/") {
      hasWildcardPublicAsset = true;
      continue;
    }
    routes.push({
      path: `${publicAsset.baseURL!.replace(/\/$/, "")}/*`,
      target: {
        kind: "Static",
        cacheControl:
          publicAsset.maxAge && publicAsset.maxAge > 0
            ? `public, max-age=${publicAsset.maxAge}, immutable`
            : undefined,
      },
      fallback: publicAsset.fallthrough ? computeTarget : undefined,
    });
  }
  if (hasWildcardPublicAsset && !fastnode.options.static) {
    routes.push({
      path: "/*.*",
      target: {
        kind: "Static",
      },
      fallback: computeTarget,
    });
  }
  routes.push({
    path: "/*",
    target: computeTarget,
    fallback:
      hasWildcardPublicAsset && fastnode.options.awsAmplify?.catchAllStaticFallback
        ? {
            kind: "Static",
          }
        : undefined,
  });

  // Prefix with baseURL
  for (const route of routes) {
    if (route.path !== "/*") {
      route.path = joinURL(fastnode.options.baseURL, route.path);
    }
  }

  // Generate deploy-manifest.json
  const deployManifest: AmplifyDeployManifest = {
    version: 1,
    routes,
    imageSettings: fastnode.options.awsAmplify?.imageSettings || undefined,
    computeResources: fastnode.options.static
      ? undefined
      : [
          {
            name: "default",
            entrypoint: "server.js",
            runtime: fastnode.options.awsAmplify?.runtime || "nodejs22.x",
          },
        ],
    framework: {
      name: fastnode.options.framework.name || "fastnode",
      version: fastnode.options.framework.version || "0.0.0",
    },
  };
  await writeFile(resolve(outDir, "deploy-manifest.json"), JSON.stringify(deployManifest, null, 2));

  // Write server.js (CJS)
  if (!fastnode.options.static) {
    await writeFile(resolve(outDir, "compute/default/server.js"), `import("./index.mjs")`);
  }
}
