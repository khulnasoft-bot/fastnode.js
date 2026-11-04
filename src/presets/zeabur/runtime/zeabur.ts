import "#fastnode/virtual/polyfills";
import { toNodeHandler } from "srvx/node";
import { useFastnodeApp } from "fastnode/app";

export default toNodeHandler(useFastnodeApp().fetch);
