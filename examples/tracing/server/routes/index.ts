import { defineHandler } from "fastnode";
import { useKV } from "fastnode/kv";

// Reads and writes storage so the request emits `unstorage.*` spans (CLIENT)
// alongside the `srvx.request`, `middleware` and route (`h3.request`) spans.
export default defineHandler(async () => {
  const storage = useKV();
  const hits = ((await storage.getItem<number>("hits")) ?? 0) + 1;
  await storage.setItem("hits", hits);
  return { message: "Hello from the Fastnode tracing demo", hits };
});
