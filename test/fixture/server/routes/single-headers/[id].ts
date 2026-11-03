import { defineHandler } from "fastnode/h3";

export default defineHandler((event) => ({ id: event.context.params?.id }));
