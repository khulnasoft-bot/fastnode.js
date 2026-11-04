import { defineHandler } from "fastnode";
import { shared } from "../shared.ts";

export default defineHandler(async (event) => {
  shared.hits++;
  const { Greeter } = (event.req.runtime!.cloudflare!.context as any).exports;
  const { greeting, hits } = await Greeter.greet("fastnode");
  return { greeting, route: shared.hits, entrypoint: hits };
});
