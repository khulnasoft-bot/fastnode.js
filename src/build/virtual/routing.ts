import type { Fastnode, FastnodeEventHandler } from "fastnode/types";
import { compileRouteRules } from "h3/rules/compiler";
import { hasServerEntryDefaultExport } from "./server-entry.ts";

export default function routing(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/routing",
    template: async () => {
      const allHandlers = uniqueBy(
        [
          ...Object.values(fastnode.routing.routes.routes).flatMap((h) => h.data),
          ...Object.values(fastnode.routing.routedMiddleware.routes).map((h) => h.data),
          ...fastnode.routing.globalMiddleware,
        ],
        "_importHash"
      );

      const traceH3 = !!fastnode.options.tracingChannel?.h3;

      const serverEntry = fastnode.options.serverEntry;
      const webServerEntry =
        serverEntry && serverEntry.handler && serverEntry.format !== "node"
          ? serverEntry.handler.replace(/\\/g, "/")
          : undefined;
      const serverEntryHasDefault =
        !!webServerEntry && (await hasServerEntryDefaultExport(fastnode));

      const routeRulesModule = compileRouteRules(fastnode.options.routeRules, {
        runtimeRules: { cache: "#fastnode/runtime/route-rule-handlers" },
        baseURL: fastnode.options.baseURL,
        preMerge: true,
      });

      return /* js */ `
import * as srvxNode from "srvx/node"
import * as h3 from "h3";${traceH3 ? `\nimport { wrapHandlerWithTracing } from "h3/tracing";` : ""}

${routeRulesModule}
const multiHandler = (...handlers) => {
  const final = handlers.pop()
  const middleware = handlers.filter(Boolean).map(h => h3.toMiddleware(h));
  return (ev) => h3.callMiddleware(ev, middleware, final);
}

${allHandlers
  .filter((h) => !h.lazy)
  .map((h) =>
    h.handler === webServerEntry
      ? serverEntryImport(h, serverEntryHasDefault)
      : /* js */ `import ${h._importHash} from ${JSON.stringify(h.handler)};`
  )
  .join("\n")}

${allHandlers
  .filter((h) => h.lazy)
  .map(
    (h) =>
      /* js */ `const ${h._importHash} = h3.defineLazyEventHandler(() => import(${JSON.stringify(h.handler)})${h.format === "node" ? ".then(m => ({ fetch: srvxNode.toFetchHandler(m.default) }))" : ""});`
  )
  .join("\n")}

export const findRoute = ${fastnode.routing.routes.compileToString({ serialize: (h) => serializeHandler(h, { tracing: traceH3 }) })}

export const findRoutedMiddleware = ${fastnode.routing.routedMiddleware.compileToString({ serialize: serializeHandlerFn, matchAll: true })};

export const globalMiddleware = [
  ${fastnode.routing.globalMiddleware.map((h) => (h.lazy ? h._importHash : `h3.toEventHandler(${h._importHash})`)).join(",")}
].filter(Boolean);
  `;
    },
  };
}

// The default export (and its `fetch`) of the server entry is optional: it can be used
// for startup logic only. Without a handler, requests continue to the renderer (or 404).
function serverEntryImport(
  h: FastnodeEventHandler & { _importHash: string },
  hasDefault: boolean
): string {
  const notFound = `() => Symbol.for("h3.notFound")`;
  if (!hasDefault) {
    return /* js */ `import ${JSON.stringify(h.handler)};
const ${h._importHash} = ${notFound};`;
  }
  const entry = `${h._importHash}_entry`;
  return /* js */ `import ${entry} from ${JSON.stringify(h.handler)};
const ${h._importHash} = typeof ${entry} === "function" || typeof ${entry}?.fetch === "function" ? ${entry} : ${notFound};`;
}

function uniqueBy<T>(arr: T[], key: keyof T): T[] {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
}

// --- Serializing ---

type MaybeArray<T> = T | T[];

function serializeHandler(
  h: MaybeArray<FastnodeEventHandler & { _importHash: string }>,
  opts: { tracing?: boolean } = {}
): string {
  const meta = Array.isArray(h) ? (h[0] as NonNullable<(typeof h)[0]>) : h;
  const handler = Array.isArray(h)
    ? `multiHandler(${h.map((handler) => serializeHandlerFn(handler)).join(",")})`
    : serializeHandlerFn(h);

  return `{${[
    `route:${JSON.stringify(meta.route)}`,
    meta.method && `method:${JSON.stringify(meta.method)}`,
    meta.meta && `meta:${JSON.stringify(meta.meta)}`,
    `handler:${opts.tracing ? `wrapHandlerWithTracing(${handler})` : handler}`,
  ]
    .filter(Boolean)
    .join(",")}}`;
}

function serializeHandlerFn(h: FastnodeEventHandler & { _importHash: string }): string {
  let code = h._importHash;
  if (!h.lazy) {
    if (h.format === "node") {
      code = `{ fetch: srvxNode.toFetchHandler(${code}) }`;
    }
    code = `h3.toEventHandler(${code})`;
  }
  return code;
}
