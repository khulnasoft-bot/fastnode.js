import { genImport, genSafeVariableName } from "knitwork";
import type { Fastnode } from "fastnode/types";
import { isDepInstalled, isLibOption } from "../../utils/dep.ts";
import { resolveKVDrivers } from "../../utils/storage.ts";
import type { ResolvedKVMount } from "../../utils/storage.ts";

export default function kv(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/kv",
    template: async () => {
      const mounts = await resolveKVDrivers(fastnode.options);

      const driverImports = [...new Set(mounts.map((m) => m.driver))];

      const tracingEnabled = !!(
        typeof fastnode.options.tracingChannel === "object" &&
        fastnode.options.tracingChannel?.unstorage
      );

      return /* js */ `
import { createStorage } from 'unstorage'
${tracingEnabled ? `import { withTracing } from 'unstorage/tracing'` : ""}
import { assets } from '#fastnode/virtual/server-assets'

${driverImports.map((i) => genImport(i, genSafeVariableName(i))).join("\n")}

export function initKV() {
  const storage = createStorage({})
  storage.mount('/assets', assets)
  ${mounts
    .map(
      (m) =>
        `storage.mount('${m.path}', ${genSafeVariableName(m.driver)}(${genDriverOptions(fastnode, m)}))`
    )
    .join("\n")}
  return ${tracingEnabled ? "withTracing(storage)" : "storage"}
}
`;
    },
  };
}

/**
 * Explicitly provide third-party libraries used by the driver via the `lib` option
 * so that they are statically analyzable by the bundler.
 */
function genDriverOptions(fastnode: Fastnode, mount: ResolvedKVMount) {
  const libs = mount.deps
    .filter(
      (dep) =>
        isLibOption(dep.option) &&
        mount.options[dep.option] === undefined &&
        isDepInstalled(dep.name, { dir: fastnode.options.rootDir, projectOnly: true })
    )
    .map((dep) => `${dep.option}: () => import(${JSON.stringify(dep.import || dep.name)})`);

  const options = JSON.stringify(mount.options);
  return libs.length > 0 ? `{ ...${options}, ${libs.join(", ")} }` : options;
}
