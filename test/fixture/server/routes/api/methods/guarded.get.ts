import { defineHandler } from "fastnode";

export default defineHandler((event) => {
  event.res.headers.set("x-handler", "get");
  return "secret";
});
