import { defineFastnodePreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import { version as fastnodeVersion } from "#fastnode/meta";
import { join, relative } from "pathe";
import { stringifyYAML } from "confbox";
import type { AppHostingOutputBundleConfig } from "./types.ts";

export type { FirebaseOptions as PresetOptions } from "./types.ts";

const firebaseAppHosting = defineFastnodePreset(
  {
    extends: "node-server",
    serveStatic: true,
    hooks: {
      async compiled(fastnode) {
        const serverEntry = join(fastnode.options.output.serverDir, "index.mjs");
        await writeFile(
          join(fastnode.options.rootDir, ".apphosting/bundle.yaml"),
          stringifyYAML({
            version: "v1",
            runConfig: {
              runCommand: `node ${relative(fastnode.options.rootDir, serverEntry)}`,
              ...fastnode.options.firebase?.appHosting,
            },
            metadata: {
              framework: fastnode.options.framework.name || "fastnode",
              frameworkVersion: fastnode.options.framework.version || "2.x",
              adapterPackageName: "fastnode",
              adapterVersion: fastnodeVersion,
            },
            outputFiles: {
              serverApp: {
                include: [relative(fastnode.options.rootDir, fastnode.options.output.dir)],
              },
            },
          } satisfies AppHostingOutputBundleConfig),
          true
        );
      },
    },
  },
  {
    name: "firebase-app-hosting" as const,
    stdName: "firebase_app_hosting",
  }
);

export default [firebaseAppHosting] as const;
