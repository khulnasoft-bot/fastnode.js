Runtime config lets you define configuration values that can be overridden by environment variables at runtime.

## Define Config Schema

Declare your runtime config with default values in `fastnode.config.ts`:

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  serverDir: "./",
  runtimeConfig: {
    apiKey: "",
  },
});
```

## Access at Runtime

Use `useRuntimeConfig` to access configuration values in your handlers:

```ts [server.ts]
import { defineHandler } from "fastnode";
import { useRuntimeConfig } from "fastnode/runtime-config";

export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig();
  return { runtimeConfig };
});
```

## Environment Variables

Override config values via environment variables prefixed with `FASTNODE_`:

```sh [.env]
# NEVER COMMIT SENSITIVE DATA. THIS IS ONLY FOR DEMO PURPOSES.
FASTNODE_API_KEY=secret-api-key
```
