import { defineHandler } from "fastnode/h3";

export default defineHandler((event) => {
  const order = (event.context.middlewareOrder ??= []) as string[];
  order.push("routed");
});
