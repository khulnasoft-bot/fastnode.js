import "#fastnode/virtual/polyfills";
import { handleLambdaEventWithStream } from "srvx/aws-lambda";
import { useFastnodeApp } from "fastnode/app";

const fastnodeApp = useFastnodeApp();

export const handler = awslambda.streamifyResponse((event, responseStream, context) =>
  handleLambdaEventWithStream(fastnodeApp.fetch, event, responseStream, context)
);
