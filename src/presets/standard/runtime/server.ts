import "#fastnode/virtual/polyfills";
import { useFastnodeApp } from "fastnode/app";

const fastnodeApp = useFastnodeApp();

export default {
  fetch: fastnodeApp.fetch,
};
