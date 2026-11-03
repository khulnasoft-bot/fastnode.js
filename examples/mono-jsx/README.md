## Server Entry

```tsx [server.tsx]
export default () => (
  <html>
    <h1>Fastnode + mono-jsx works!</h1>
  </html>
);
```

Fastnode auto-detects `server.tsx` and uses mono-jsx to transform JSX into HTML. Export a function that returns JSX, and Fastnode sends the rendered HTML as the response.
