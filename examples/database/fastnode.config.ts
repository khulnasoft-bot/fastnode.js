import { defineConfig } from "fastnode";

export default defineConfig({
  experimental: {
    database: true,
    tasks: true,
  },
  database: {
    default: { connector: "sqlite" },
  },
});
