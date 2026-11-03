import { defineHandler } from "fastnode";
import { useRuntimeConfig } from "fastnode/runtime-config";

export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig();
  return { runtimeConfig };
});
