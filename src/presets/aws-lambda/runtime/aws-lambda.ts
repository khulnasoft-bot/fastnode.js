import "#fastnode/virtual/polyfills";
import { handleLambdaEvent } from "srvx/aws-lambda";
import { useFastnodeApp } from "fastnode/app";

import type { AwsLambdaEvent } from "srvx/aws-lambda";
import type { Context } from "aws-lambda";

const fastnodeApp = useFastnodeApp();

export async function handler(event: AwsLambdaEvent, context: Context) {
  return handleLambdaEvent(fastnodeApp.fetch, event, context);
}
