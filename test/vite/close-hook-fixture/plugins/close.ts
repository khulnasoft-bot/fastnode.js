import { appendFileSync } from "node:fs";
import { definePlugin } from "fastnode";

export default definePlugin((fastnodeApp) => {
  fastnodeApp.hooks.hook("close", async () => {
    const log = process.env.FASTNODE_TEST_CLOSE_LOG;
    if (!log) {
      return;
    }
    // Deliberately async: the assertion only holds if `close` hooks are awaited.
    await new Promise((resolve) => setTimeout(resolve, 50));
    appendFileSync(log, "runtime:close\n");
  });
});
