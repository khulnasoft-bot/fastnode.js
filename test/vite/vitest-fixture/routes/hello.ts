import { defineHandler } from "fastnode";
import { useRuntimeConfig } from "fastnode/runtime-config";

export default defineHandler(() => ({ greeting: useRuntimeConfig().greeting }));
