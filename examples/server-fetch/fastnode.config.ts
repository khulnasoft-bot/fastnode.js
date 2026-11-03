import { defineConfig, serverFetch } from "fastnode";

export default defineConfig({
  serverDir: "./",
  hooks: {
    "dev:start": async () => {
      const res = await serverFetch("/hello");
      const text = await res.text();
      console.log("Fetched /hello in fastnode module:", res.status, text);
    },
  },
});
