import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  plugins: [
    fastnode(),
    {
      name: "my-fastnode-plugin",
      fastnode: {
        setup: (fastnode) => {
          fastnode.options.routes["/"] = "#virtual-by-plugin";
          fastnode.options.virtual["#virtual-by-plugin"] =
            `export default () => new Response("Hello from virtual entry!")`;
        },
      },
    },
  ],
});
