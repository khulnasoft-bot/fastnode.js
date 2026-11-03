import { defineHandler } from "fastnode";
import { useRuntimeConfig } from "fastnode/runtime-config";

export default defineHandler((event) => ({
  id: event.context.params?.id,
  hasRuntimeConfig: "app" in useRuntimeConfig(),
}));
