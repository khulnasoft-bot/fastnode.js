import { definePlugin } from "fastnode";
import { value } from "../utils/value.ts";

export default definePlugin(() => {
  (globalThis as any).__pluginValue = value;
});
