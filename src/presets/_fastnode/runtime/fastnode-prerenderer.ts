import "#fastnode/virtual/polyfills";
import { HTTPError } from "h3";
import { useFastnodeApp, useFastnodeHooks } from "fastnode/app";

const fastnodeApp = useFastnodeApp();
const fastnodeHooks = useFastnodeHooks();

export default {
  fetch: fastnodeApp.fetch,
  close: () => fastnodeHooks.callHook("close"),
};

fastnodeHooks.hook("error", (error, context) => {
  if (
    !(error as HTTPError).unhandled &&
    (error as HTTPError).status >= 500 &&
    context.event?.req?.headers instanceof Headers &&
    context.event.req.headers.get("x-fastnode-prerender")
  ) {
    console.error(
      `[prerender error]`,
      `[${context.event.req.method}]`,
      `[${context.event.req.url}]`,
      error
    );
  }
});
