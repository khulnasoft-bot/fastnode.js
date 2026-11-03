import "#fastnode/virtual/polyfills";
import { useFastnodeApp } from "fastnode/app";
import { isPublicAssetURL } from "#fastnode/virtual/public-assets";
import type { Context } from "@netlify/edge-functions";
import type { ServerRequest } from "srvx";

const fastnodeApp = useFastnodeApp();

// https://docs.netlify.com/edge-functions/api/
export default async function netlifyEdge(netlifyReq: Request, context: Context) {
  // srvx compatibility
  const req = netlifyReq as unknown as ServerRequest;
  req.ip = context.ip;
  req.runtime ??= { name: "netlify-edge" };
  req.runtime.netlify ??= { context } as any;

  const url = new URL(req.url);

  if (isPublicAssetURL(url.pathname)) {
    return;
  }

  if (!req.headers.has("x-forwarded-proto") && url.protocol === "https:") {
    req.headers.set("x-forwarded-proto", "https");
  }

  return fastnodeApp.fetch(req);
}
