import { defineHandler } from "fastnode/h3";

export default defineHandler((event) => {
  return (event.context.middlewareOrder ?? []) as string[];
});
