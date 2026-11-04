import { defineHandler } from "fastnode";

export default defineHandler(async (event) => {
  const body = await event.req.text();
  return { length: body.length };
});
