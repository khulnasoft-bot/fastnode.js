import { existsSync, promises as fsp } from "node:fs";
import type { Fastnode, PublicAssetDir } from "fastnode/types";
import { dirname, join } from "pathe";
import { joinURL, withoutTrailingSlash } from "ufo";
import { escapeRegExp } from "../../utils/regex.ts";
import { getPublicAssetCorsHeaders } from "../_utils/cors.ts";
import { hasHeaders, routeToSplat, skipUnsupportedRoute, sortRoutes } from "../_utils/routes.ts";

export async function writeRedirects(fastnode: Fastnode) {
  let contents = "";

  // Most specific first, as the first matching rule wins
  const routes = sortRoutes(Object.keys(fastnode.options.routeRules));
  const redirects = routes.filter((key) => fastnode.options.routeRules[key]!.redirect);
  for (const key of routes) {
    const redirect = fastnode.options.routeRules[key]!.redirect;
    if (
      !redirect ||
      skipUnsupportedRoute(fastnode, { route: key, file: "_redirects", routes: redirects })
    ) {
      continue;
    }
    let code = redirect.status;
    // TODO: Remove map when netlify support 307/308
    // Netlify _redirects currently only supports 301, 302, 404, 200.
    // Tracking: https://docs.netlify.com/manage/routing/redirects/redirect-options/
    if (code === 307) {
      code = 302;
    }
    if (code === 308) {
      code = 301;
    }
    const from = joinURL(fastnode.options.baseURL, routeToSplat(key));
    contents += `${from}\t${redirect.to.replaceAll("**", ":splat")}\t${code}\n`;
  }

  if (fastnode.options.static && existsSync(join(fastnode.options.output.publicDir, "404.html"))) {
    contents += `${joinURL(fastnode.options.baseURL, "/*")} ${joinURL(fastnode.options.baseURL, "/404.html")} 404`;
  }

  await writePublishFile(fastnode, "_redirects", contents);
}

export async function writeHeaders(fastnode: Fastnode) {
  let contents = "";

  for (const path of sortRoutes(Object.keys(fastnode.options.routeRules))) {
    const routeRules = fastnode.options.routeRules[path]!;
    if (
      !hasHeaders(routeRules) ||
      skipUnsupportedRoute(fastnode, { route: path, file: "_headers" })
    ) {
      continue;
    }
    const headers = [
      joinURL(fastnode.options.baseURL, routeToSplat(path)),
      ...Object.entries({ ...routeRules.headers }).map(
        ([header, value]) => `  ${header}: ${value}`
      ),
    ].join("\n");

    contents += headers + "\n";
  }

  const userHeadersPath = join(fastnode.options.output.publicDir, "_headers");
  const headersFile = existsSync(userHeadersPath)
    ? await fsp.readFile(userHeadersPath, "utf8")
    : undefined;
  for (const { base, headers } of getPublicAssetCorsHeaders(fastnode, { headersFile })) {
    contents +=
      [
        joinURL(fastnode.options.baseURL, base, "*"),
        ...Object.entries(headers).map(([header, value]) => `  ${header}: ${value}`),
      ].join("\n") + "\n";
  }

  await writePublishFile(fastnode, "_headers", contents);
}

export async function writeConfig(fastnode: Fastnode, configPath: string) {
  const netlify = fastnode.options.netlify;
  if (Object.keys(netlify?.config || {}).length === 0) {
    await fsp.rm(configPath, { force: true });
    return;
  }
  await fsp.mkdir(dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(netlify!.config), "utf8");
}

export function getStaticPaths(publicAssets: PublicAssetDir[], baseURL: string): string[] {
  return [
    "/.netlify/*", // TODO: should this be also be prefixed with baseURL?
    ...publicAssets
      .filter((a) => a.fallthrough !== true && a.baseURL && a.baseURL !== "/")
      .map((a) => joinURL(baseURL, a.baseURL!, "*")),
  ];
}

// This is written to the (edge) functions directory. It just re-exports the compiled handler,
// along with its config. We do this instead of compiling the entrypoint directly because
// the Netlify platform actually statically analyzes the function file to read the config;
// if we compiled the entrypoint directly, it would be chunked and wouldn't be analyzable.
export function generateNetlifyFunction(fastnode: Fastnode) {
  return /* js */ `
export { default } from "./main.mjs";
export const config = {
  name: "server handler",
  generator: "${getGeneratorString(fastnode)}",
  path: "/*",
  nodeBundler: "none",
  includedFiles: ["**"],
  excludedPath: ${JSON.stringify(getStaticPaths(fastnode.options.publicAssets, fastnode.options.baseURL))},
  preferStatic: true,
};
    `.trim();
}

export function generateNetlifyEdgeFunction(fastnode: Fastnode) {
  return /* js */ `
export { default } from "./main.mjs";
export const config = {
  name: "edge server handler",
  generator: "${getGeneratorString(fastnode)}",
  path: "/*",
  excludedPath: ${JSON.stringify(getStaticPaths(fastnode.options.publicAssets, fastnode.options.baseURL))},
};
    `.trim();
}

export function getGeneratorString(fastnode: Fastnode) {
  return `${fastnode.options.framework.name}@${fastnode.options.framework.version}`;
}

/**
 * Write `_redirects` or `_headers` to the root of the publish directory, where
 * Netlify reads them, merged after the user's own file from `public/`.
 *
 * Public assets are output to `dist/{{ baseURL }}`, so with a baseURL the
 * user's file is read from there and moved to the root. The root copy itself
 * is never read: it is the output of a previous build.
 */
async function writePublishFile(
  fastnode: Fastnode,
  name: "_redirects" | "_headers",
  contents: string
) {
  const sourcePath = join(fastnode.options.output.publicDir, name);
  const targetPath = join(getPublishDir(fastnode), name);

  if (existsSync(sourcePath)) {
    const current = await fsp.readFile(sourcePath, "utf8");
    if (sourcePath !== targetPath) {
      await fsp.rm(sourcePath);
    }
    const fallbackRE = new RegExp(
      `^(?:/|${escapeRegExp(joinURL(fastnode.options.baseURL, "/"))})\\* `,
      "m"
    );
    if (fallbackRE.test(current)) {
      fastnode.logger.info(
        `Not adding Fastnode fallback to \`${name}\` (as an existing fallback was found).`
      );
      contents = current;
    } else {
      fastnode.logger.info(
        `Adding Fastnode fallback to \`${name}\` to handle all unmatched routes.`
      );
      contents = current + "\n" + contents;
    }
  }

  await fsp.writeFile(targetPath, contents);
}

// Public assets are output to `dist/{{ baseURL }}`, unless `publicDir` is customized
function getPublishDir(fastnode: Fastnode) {
  const publicDir = withoutTrailingSlash(fastnode.options.output.publicDir);
  const base = withoutTrailingSlash(fastnode.options.baseURL);
  return base && publicDir.endsWith(base) ? publicDir.slice(0, -base.length) : publicDir;
}
