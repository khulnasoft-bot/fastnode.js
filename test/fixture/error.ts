import { defineErrorHandler } from "fastnode";

export default defineErrorHandler(async (error, event, { defaultHandler }) => {
  if (event.req.url.includes("?json")) {
    const res = await defaultHandler(error, event, { json: true });
    return Response.json({ json: res.body });
  }
  return undefined;
});
