import { defineFastnodePreset } from "../_utils/preset.ts";

const genezio = defineFastnodePreset(
  {
    extends: "aws_lambda",
  },
  {
    name: "genezio" as const,
  }
);
export default [genezio] as const;
