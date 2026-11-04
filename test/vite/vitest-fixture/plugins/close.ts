import { appendFileSync } from "node:fs";
import { definePlugin, serverFetch } from "fastnode";

export default definePlugin((fastnodeApp) => {
  fastnodeApp.hooks.hook("close", async () => {
    if (process.env.FASTNODE_TEST_CLOSE_LOG) {
      // The app must still be reachable while `close` hooks run
      const res = await serverFetch("/hello");
      appendFileSync(process.env.FASTNODE_TEST_CLOSE_LOG, `runtime:close:${res.status}\n`);
    }
  });
});
