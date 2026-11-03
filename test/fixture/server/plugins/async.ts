import { definePlugin } from "fastnode";

export default definePlugin(async (fastnodeApp) => {
  const value = await Promise.resolve("async plugin works!");
  fastnodeApp.hooks.hook("response", (res) => {
    res.headers.set("x-async-plugin", value);
  });
});
