import { glob } from "tinyglobby";
import type { Fastnode } from "fastnode/types";
import { join, relative } from "pathe";
import { withBase, withLeadingSlash, withoutTrailingSlash } from "ufo";
import { parseScanPath } from "../../utils/scan-suffix.ts";
import type { ParsedScanPath, ScanSuffixOptions } from "../../utils/scan-suffix.ts";

export const GLOB_SCAN_PATTERN = "**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}";

// Co-located tests and type declarations are never registered.
const GLOB_SCAN_IGNORE = [
  "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,tsx,jsx}",
  "**/*.d.{ts,mts,cts}",
];

// Modules are only auto-registered from `modules/*` and `modules/*/index` (any supported
// extension) so that a module's own nested files are not registered as modules themselves.
const GLOB_MODULES_SCAN_PATTERN = [
  "*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}",
  "*/index.{js,mjs,cjs,ts,mts,cts,tsx,jsx}",
];
type FileInfo = { path: string; fullPath: string };

export async function scanAndSyncOptions(fastnode: Fastnode) {
  // Scan plugins
  const scannedPlugins = await scanPlugins(fastnode);
  for (const plugin of scannedPlugins) {
    if (!fastnode.options.plugins.includes(plugin)) {
      fastnode.options.plugins.push(plugin);
    }
  }

  // Scan tasks
  if (fastnode.options.experimental.tasks) {
    const scannedTasks = await scanTasks(fastnode);
    for (const scannedTask of scannedTasks) {
      if (scannedTask.name in fastnode.options.tasks) {
        if (!fastnode.options.tasks[scannedTask.name]!.handler) {
          fastnode.options.tasks[scannedTask.name]!.handler = scannedTask.handler;
        }
      } else {
        fastnode.options.tasks[scannedTask.name] = {
          handler: scannedTask.handler,
          description: "",
        };
      }
    }
  }

  // Scan modules
  const scannedModules = await scanModules(fastnode);
  fastnode.options.modules = fastnode.options.modules || [];
  for (const modPath of scannedModules) {
    if (!fastnode.options.modules.includes(modPath)) {
      fastnode.options.modules.push(modPath);
    }
  }
}

export async function scanHandlers(fastnode: Fastnode) {
  const middleware = await scanMiddleware(fastnode);

  const handlers = await Promise.all([
    scanServerRoutes(
      fastnode,
      fastnode.options.apiDir || "api",
      fastnode.options.apiBaseURL || "/api"
    ),
    scanServerRoutes(fastnode, fastnode.options.routesDir || "routes"),
  ]).then((r) => r.flat());

  const seenHandlers = new Set<string>();
  fastnode.scannedHandlers = [
    ...middleware,
    ...handlers.filter((h) => {
      const key = `${h.route}\0${h.method}\0${h.env}`;
      return seenHandlers.has(key) ? false : (seenHandlers.add(key), true);
    }),
  ];

  fastnode.routing.sync();

  return handlers;
}

export async function scanMiddleware(fastnode: Fastnode) {
  const files = await scanFiles(fastnode, "middleware");
  return files.map((file) => {
    return {
      route: "/**",
      middleware: true,
      handler: file.fullPath,
    };
  });
}

export async function scanServerRoutes(fastnode: Fastnode, dir: string, prefix = "/") {
  const files = await scanFiles(fastnode, dir, { suffixes: { method: true, env: true } });
  return files.map((file) => {
    const paramName = (name: string) => {
      const sanitized = name.replace(/\W/g, "_");
      if (name.includes("-")) {
        fastnode.logger.warn(
          `Route param \`[${name}]\` in \`${file.path}\` is available as \`params.${sanitized}\`, since param names cannot contain \`-\`. Rename it to silence this warning.`
        );
      }
      return sanitized;
    };
    let route = file.name
      .replace(/\(([^(/\\]+)\)[/\\]/g, "")
      .replace(/\[\.{3}]/g, "**")
      .replace(/\[\.{3}([^\]]+)]/g, (_, p) => ":" + paramName(p) + "(.*)")
      .replace(/\[([^/\]]+)]/g, (_, p) => ":" + paramName(p));
    route = withLeadingSlash(withoutTrailingSlash(withBase(route, prefix)));
    route = route.replace(/\/index$/, "") || "/";

    return {
      handler: file.fullPath,
      lazy: true,
      middleware: false,
      route,
      method: file.method,
      env: file.env,
    };
  });
}

export async function scanPlugins(fastnode: Fastnode) {
  const files = await scanFiles(fastnode, "plugins");
  return files.map((f) => f.fullPath);
}

export async function scanTasks(fastnode: Fastnode) {
  const files = await scanFiles(fastnode, "tasks");
  return files.map((f) => {
    const name = f.path
      .replace(/\/index$/, "")
      .replace(/\.[A-Za-z]+$/, "")
      .replace(/\//g, ":");
    return { name, handler: f.fullPath };
  });
}

export async function scanModules(fastnode: Fastnode) {
  const files = await scanFiles(fastnode, "modules", { pattern: GLOB_MODULES_SCAN_PATTERN });
  return files.map((f) => f.fullPath);
}

async function scanFiles(
  fastnode: Fastnode,
  name: string,
  opts: { pattern?: string | string[]; suffixes?: ScanSuffixOptions } = {}
): Promise<(FileInfo & ParsedScanPath)[]> {
  const files = await Promise.all(
    fastnode.options.scanDirs.map((dir) =>
      scanDir(fastnode, dir, name, opts.pattern || GLOB_SCAN_PATTERN)
    )
  ).then((r) => r.flat());
  return files.flatMap((file) => {
    const parsed = parseScanPath(fastnode, { dir: name, path: file.path }, opts.suffixes);
    return parsed ? [{ ...file, ...parsed }] : [];
  });
}

async function scanDir(
  fastnode: Fastnode,
  dir: string,
  name: string,
  pattern: string | string[]
): Promise<FileInfo[]> {
  const patterns = (Array.isArray(pattern) ? pattern : [pattern]).map((p) => join(name, p));
  const fileNames = await glob(patterns, {
    cwd: dir,
    dot: true,
    ignore: [...GLOB_SCAN_IGNORE, ...(fastnode.options.ignore || [])],
    absolute: true,
  }).catch((error) => {
    if (error?.code === "ENOTDIR") {
      fastnode.logger.warn(`Ignoring \`${join(dir, name)}\`. It must be a directory.`);
      return [];
    }
    throw error;
  });
  return fileNames
    .map((fullPath) => {
      return {
        fullPath,
        path: relative(join(dir, name), fullPath),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
