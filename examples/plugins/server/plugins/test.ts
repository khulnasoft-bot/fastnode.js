import { definePlugin } from "fastnode";
import { useFastnodeHooks } from "fastnode/app";

export default definePlugin(() => {
  const hooks = useFastnodeHooks();
  hooks.hook("response", (res) => {
    res.headers.set("content-type", "html; charset=utf-8");
  });
});
