## Server Entry

```tsx [server.tsx]
import { defineHandler, html } from "fastnode";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Fastnode + nano-jsx works!</h1>));
});
```

Fastnode auto-detects `server.tsx` and uses it as the server entry. Use `renderSSR` from nano-jsx to convert JSX into an HTML string. The `html` helper from H3 sets the correct content type header.
