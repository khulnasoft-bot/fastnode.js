import { defineHandler } from "fastnode";

export default defineHandler((event) => `Hello (param: ${event.context.params!.name})!`);
