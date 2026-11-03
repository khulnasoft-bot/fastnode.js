import { defineFastnodePreset } from "../_utils/preset.ts";

const stormkit = defineFastnodePreset(
  {
    entry: "./stormkit/runtime/stormkit",
    output: {
      dir: "{{ rootDir }}/.stormkit",
      publicDir: "{{ rootDir }}/.stormkit/public/{{ baseURL }}",
    },
  },
  {
    name: "stormkit" as const,
    stdName: "stormkit",
  }
);

export default [stormkit] as const;
