import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";
import { joinURL } from "ufo";

const baseURL = process.env.FASTNODE_TEST_BASE_URL || "/";

const probe = (event: { url: URL }) => `probe:${event.url.pathname}`;

export default defineConfig({
  base: joinURL(baseURL, "_assets/"),
  plugins: [
    fastnode({
      serverDir: "./",
      serveStatic: false,
      baseURL,
      publicAssets: [{ dir: "pub-assets", baseURL: "/pub", fallthrough: false }],
      devHandlers: [
        { route: joinURL(baseURL, "_assets/probe/**"), handler: probe },
        { route: joinURL(baseURL, "_probe/**"), handler: probe },
        {
          route: joinURL(baseURL, "_assets/missing/**"),
          handler: () => new Response("missing", { status: 404 }),
        },
        { route: joinURL(baseURL, "**"), handler: () => "catch-all" },
      ],
      devProxy: {
        [joinURL(baseURL, "_assets/upstream/**")]: { target: process.env.FASTNODE_TEST_UPSTREAM },
      },
    }),
  ],
});
