import "#fastnode/virtual/polyfills";
import { useFastnodeApp } from "fastnode/app";

import { Server } from "node:http";
import type { NodeHttp1Handler } from "srvx";
import { toNodeHandler } from "srvx/node";

const fastnodeApp = useFastnodeApp();

const server = new Server(toNodeHandler(fastnodeApp.fetch) as NodeHttp1Handler);

// @ts-ignore
server.listen(3000, (err) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Listening on http://localhost:3000 (AWS Amplify Hosting)`);
  }
});
