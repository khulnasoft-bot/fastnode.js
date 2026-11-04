import type { Fastnode } from "fastnode/types";

export default function featureFlags(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/feature-flags",
    template: () => {
      const featureFlags: Record<string, boolean> = {
        // Routing
        hasRoutes: fastnode.routing.routes.hasRoutes(),
        hasRouteRules: fastnode.routing.routeRules.hasRoutes(),
        hasRoutedMiddleware: fastnode.routing.routedMiddleware.hasRoutes(),
        hasGlobalMiddleware: fastnode.routing.globalMiddleware.length > 0,
        // Plugins
        hasPlugins: fastnode.options.plugins.length > 0,
        hasHooks: fastnode.options.features?.runtimeHooks ?? fastnode.options.plugins.length > 0,
      };
      return /* js */ Object.entries(featureFlags)
        .map(([key, value]) => /* js */ `export const ${key} = ${Boolean(value)};`)
        .join("\n");
    },
  };
}
