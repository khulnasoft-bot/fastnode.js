Instead of using a separate `fastnode.config.ts`, you can configure Fastnode directly in your Vite config. This gives you access to Fastnode's setup hook where you can register routes and virtual modules programmatically.

## Vite Configuration

```js [vite.config.mjs]
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
```

The config adds two plugins: the `fastnode()` plugin and a custom plugin that uses the `fastnode.setup` hook. Inside the setup function, you have access to Fastnode's options object. This example registers a virtual route at `/` that maps to a virtual module `#virtual-by-plugin`, then defines that module inline.
