import type { ServerOptions, ServerRequest } from "srvx";

export type { ServerRequest, ServerRequestContext, ServerRuntimeContext } from "srvx";

/**
 * Default export of a server entry (`server.ts`).
 *
 * `fetch` handles requests no route matched (return nothing to continue to the renderer).
 * It is optional, for entries that only run startup logic or set server options.
 * Other options are passed to the srvx server of the `node`, `bun` and `deno` presets.
 *
 * Only server options that are safe to ignore by other presets (and explicit runtime specific
 * `node`, `bun` and `deno` options) are supported. Options that change request handling
 * (`middleware`, `plugins`, `error`) are not, as they would not apply to serverless presets or
 * `fastnodeApp.fetch`.
 *
 * @see https://fastnode.khulnasoft.com/docs/server-entry
 */
export interface FastnodeServerEntry extends Pick<
  ServerOptions,
  | "port"
  | "hostname"
  | "reusePort"
  | "protocol"
  | "tls"
  | "silent"
  | "gracefulShutdown"
  | "maxRequestBodySize"
  | "trustProxy"
  | "node"
  | "bun"
  | "deno"
> {
  fetch?: (request: ServerRequest) => Response | undefined | Promise<Response | undefined>;
}
