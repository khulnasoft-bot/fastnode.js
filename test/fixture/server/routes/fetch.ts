import {
  serverFetch as runtimeServerFetch,
  fetch as runtimeFetch,
  useFastnodeApp,
} from "fastnode/app";

import { serverFetch as fastnodeServerFetch, fetch as fastnodeFetch } from "fastnode";

export default async () => {
  const fastnodeApp = useFastnodeApp();
  return {
    "fastnodeApp.fetch": await Promise.resolve(
      fastnodeApp.fetch(new Request(new URL("/api/hello", "http://localhost")))
    ).then((res) => res.json()),
    "fastnode/runtime.serverFetch": await runtimeServerFetch("/api/hello").then((res) =>
      res.json()
    ),
    "fastnode/runtime.fetch": await runtimeFetch("/api/hello").then((res) => res.json()),
    "fastnode/runtime.fetch.url": await runtimeFetch(new URL("http://localhost/api/hello")).then(
      (res) => res.json()
    ),
    "fastnode/serverFetch": await fastnodeServerFetch("/api/hello").then((res) => res.json()),
    "fastnode/fetch": await fastnodeFetch("/api/hello").then((res) => res.json()),
  };
};
