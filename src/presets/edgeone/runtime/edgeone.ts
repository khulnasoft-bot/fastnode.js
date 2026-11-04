import "#fastnode/virtual/polyfills";
import { NodeRequest } from "srvx/node";
import { useFastnodeApp } from "fastnode/app";
import type { IncomingMessage } from "node:http";

const fastnodeApp = useFastnodeApp();

interface EdgeOneRequest extends IncomingMessage {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

// EdgeOne bootstrap expects: async (req, context) => Response
export default async function handle(req: EdgeOneRequest) {
  // Use srvx NodeRequest to convert Node.js request to Web Request
  const request = new NodeRequest({ req });
  return fastnodeApp.fetch(request);
}
