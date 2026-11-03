import { defineHandler, html } from "fastnode";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Fastnode + nano-jsx works!</h1>));
});
