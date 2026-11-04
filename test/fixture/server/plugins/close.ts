import { definePlugin } from "fastnode";

export default definePlugin((fastnodeApp) => {
  fastnodeApp.hooks.hook("close", async () => {
    if (!globalThis.process?.env?.FASTNODE_TEST_CLOSE_HOOK) {
      return;
    }
    // Deliberately async: the shutdown tests assert the marker is printed before
    // the process exits, which only holds if `close` hooks are awaited.
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("[fixture] close hook called");
  });
});
