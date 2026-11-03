import { defineHandler } from "fastnode";

export default defineHandler((event) => ({
  auth: event.context.auth,
}));
