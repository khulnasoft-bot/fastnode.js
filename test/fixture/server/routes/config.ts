import { useRuntimeConfig } from "fastnode/runtime-config";

const sharedRuntimeConfig = useRuntimeConfig();

export default () => {
  const runtimeConfig = useRuntimeConfig();

  return {
    runtimeConfig,
    sharedRuntimeConfig,
  };
};
