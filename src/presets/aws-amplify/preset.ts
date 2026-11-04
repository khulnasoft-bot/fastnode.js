import { defineFastnodePreset } from "../_utils/preset.ts";
import { writeAmplifyFiles } from "./utils.ts";

export type { AwsAmplifyOptions as PresetOptions } from "./types.ts";

const awsAmplify = defineFastnodePreset(
  {
    entry: "./aws-amplify/runtime/aws-amplify",
    manifest: {
      // https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html#amplify-console-environment-variables
      deploymentId: process.env.AWS_JOB_ID,
    },
    serveStatic: true,
    output: {
      dir: "{{ rootDir }}/.amplify-hosting",
      serverDir: "{{ output.dir }}/compute/default",
      publicDir: "{{ output.dir }}/static{{ baseURL }}",
    },
    commands: {
      preview: "node ./compute/default/server.js",
    },
    hooks: {
      async compiled(fastnode) {
        await writeAmplifyFiles(fastnode);
      },
    },
  },
  {
    name: "aws-amplify" as const,
    stdName: "aws_amplify",
  }
);

export default [awsAmplify] as const;
