# AWS Lambda

> Deploy Fastnode apps to AWS Lambda.

**Preset:** `aws_lambda`

:read-more{title="AWS Lambda" to="https://aws.amazon.com/lambda/"}

Fastnode provides a built-in preset to generate output compatible with [AWS Lambda](https://aws.amazon.com/lambda/).
The output entrypoint in `.output/server/index.mjs` is compatible with the [AWS Lambda format](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html).

It can be used programmatically or as part of a deployment.

```ts
import { handler } from './.output/server'

// Use programmatically
const { statusCode, headers, body } = handler({ rawPath: '/' })
```

## Inlining chunks

By default, Fastnode output uses dynamic chunks to lazy-load code only when needed. However, this is not always ideal for performance (see the discussion in [khulnasoft/fastnode#650](https://github.com/khulnasoft/fastnode/pull/650)). You can enable chunk inlining using the [`inlineDynamicImports`](/config/build#inlinedynamicimports) config.

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  inlineDynamicImports: true
});
```


## Response streaming

:read-more{title="Introducing AWS Lambda response streaming" to="https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/"}

To enable response streaming, set the `awsLambda.streaming` flag:

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  awsLambda: {
    streaming: true
  }
});
```
