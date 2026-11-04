import { handleCallback, send } from "@vercel/queue";
import { defineHandler } from "fastnode";
import { useFastnodeApp, useFastnodeHooks } from "fastnode/app";

export default defineHandler((event) => {
  return handleCallback(async (message, metadata) => {
    try {
      await useFastnodeHooks().callHook("vercel:queue", { message, metadata, send });
    } catch (error) {
      console.error("[vercel:queue]", error);
      useFastnodeApp().captureError?.(error as Error, { event, tags: ["vercel:queue"] });
      throw error;
    }
  })(event.req as Request);
});
