import * as queueSdk from "@vercel/queue";
import { send } from "@vercel/queue";
import { useRuntimeConfig } from "fastnode/runtime-config";
import { registerVercelQueueConsumer } from "env-runner/runners/vercel/queue-dev";

import type { MessageMetadata } from "@vercel/queue";
import type { FastnodeAppPlugin } from "fastnode/types";

interface DevTrigger {
  topic: string;
  retryAfterSeconds?: number;
  initialDelaySeconds?: number;
}

const queueDevPlugin: FastnodeAppPlugin = (fastnodeApp) => {
  const triggers =
    (useRuntimeConfig() as { vercel?: { queues?: { triggers?: DevTrigger[] } } }).vercel?.queues
      ?.triggers || [];

  if (triggers.length === 0) {
    return;
  }

  const unregisters: Array<() => void> = [];

  const ready = Promise.all(
    triggers.map((trigger) =>
      registerVercelQueueConsumer({
        // The SDK is owned by the app, so hand env-runner the instance we bundled.
        sdk: queueSdk,
        topic: trigger.topic,
        retryAfterSeconds: trigger.retryAfterSeconds,
        handler: async (message: unknown, metadata: unknown) => {
          try {
            await fastnodeApp.ready;
            await fastnodeApp.hooks.callHook("vercel:queue", {
              message,
              metadata: metadata as MessageMetadata,
              send,
            });
          } catch (error) {
            console.error("[vercel:queue]", error);
            fastnodeApp.captureError?.(error as Error, {
              tags: ["vercel:queue"],
            });
            // Rethrow so @vercel/queue schedules a local retry.
            throw error;
          }
        },
      }).then((unregister) => {
        unregisters.push(unregister);
      })
    )
  ).catch((error) => {
    console.error("[vercel:queue] failed to register dev consumer:", error);
  });

  fastnodeApp.hooks.hook("close", async () => {
    await ready;
    for (const unregister of unregisters) {
      try {
        unregister();
      } catch {}
    }
  });
};

export default queueDevPlugin;
