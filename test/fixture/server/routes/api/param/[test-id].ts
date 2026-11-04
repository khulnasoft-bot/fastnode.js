import { defineHandler } from "fastnode/h3";

export default defineHandler((event) => {
  event.res.headers.set("Content-Type", "text/plain; custom");
  return event.context.params!.test_id;
});
