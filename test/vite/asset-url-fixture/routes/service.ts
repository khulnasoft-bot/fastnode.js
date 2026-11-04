import { defineHandler } from "fastnode";
import { fetchViteEnv } from "fastnode/vite/runtime";

export default defineHandler((event) => fetchViteEnv("api", event.req as Request));
