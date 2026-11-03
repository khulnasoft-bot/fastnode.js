Plugins let you hook into Fastnode's runtime lifecycle. This example shows a plugin that modifies the `Content-Type` header on every response. Create files in `server/plugins/` and they're automatically loaded at startup.

## Defining a Plugin

```ts [server/plugins/test.ts]
import { definePlugin } from "fastnode";
import { useFastnodeHooks } from "fastnode/app";

export default definePlugin(() => {
  const hooks = useFastnodeHooks();
  hooks.hook("response", (res) => {
    res.headers.set("content-type", "html; charset=utf-8");
  });
});
```

The plugin uses `useFastnodeHooks()` to access the hooks system, then registers a `response` hook that runs after every request and receives the outgoing `Response`. Here it sets the content type to HTML, but you could log requests, add security headers, or modify responses in any way.

## Main Handler

```ts [server.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "<h1>Hello Fastnode!</h1>");
```

The handler returns HTML without setting a content type. The plugin automatically adds the correct `Content-Type: html; charset=utf-8` header to the response.
