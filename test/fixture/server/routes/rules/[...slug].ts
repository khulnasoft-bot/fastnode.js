import { defineHandler } from "fastnode/h3";

export default defineHandler((event) => event.url.pathname);
