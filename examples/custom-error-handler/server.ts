import { defineHandler, HTTPError } from "fastnode";

export default defineHandler(() => {
  throw new HTTPError("Example Error!", { status: 500 });
});
