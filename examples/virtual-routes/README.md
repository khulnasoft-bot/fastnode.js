Virtual routes let you define handlers as strings in your config instead of creating separate files. This is useful when generating routes dynamically, building plugins, or keeping simple routes inline.

## Configuration

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  routes: {
    "/": "#virtual-route",
  },
  virtual: {
    "#virtual-route": () =>
      /* js */ `export default () => new Response("Hello from virtual entry!")`,
  },
});
```

The `routes` option maps URL paths to virtual module identifiers (prefixed with `#`). The `virtual` option defines the module content as a string or function returning a string. At build time, Fastnode resolves these virtual modules to actual handlers.

There are no route files in this project. The entire handler is defined inline in the config, and Fastnode generates the route at build time.
