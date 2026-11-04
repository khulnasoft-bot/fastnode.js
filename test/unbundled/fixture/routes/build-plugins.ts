import { defineHandler } from "fastnode";
// @ts-ignore
import message from "virtual:build-plugin";
// @ts-ignore
import promise from "virtual:promise";
// @ts-ignore
import nestedPromise from "virtual:nested-promise";

export default defineHandler(() => ({
  message,
  transform: "__BUILD_PLUGIN_TRANSFORM__",
  promise,
  nestedPromise,
}));
