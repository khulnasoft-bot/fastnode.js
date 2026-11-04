When you need one route to call another, use Fastnode's `fetch` function instead of the global fetch. It makes internal requests that stay in-process, avoiding network round-trips. The request never leaves the server.

## Main Route

```ts [routes/index.ts]
import { defineHandler } from "fastnode";
import { fetch } from "fastnode";

export default defineHandler(() => fetch("/hello"));
```

The index route imports `fetch` from `fastnode` (not the global fetch) and calls the `/hello` route. This request is handled internally without going through the network stack.

## Internal API Route

```ts [routes/hello.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "Hello!");
```

A simple route that returns "Hello!". When the index route calls `fetch("/hello")`, this handler runs and its response is returned directly.
