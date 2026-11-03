import type { Fastnode } from "fastnode/types";

export default function routingMeta(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/routing-meta",
    template: () => {
      const handlers = Object.values(fastnode.routing.routes.routes).flatMap((h) => h.data);
      const routeHandlers = uniqueBy(handlers, "_importHash");

      return /* js */ `
  ${routeHandlers
    .map((h) =>
      // Virtual handlers have no source to read the meta from
      h.handler in fastnode.options.virtual
        ? /* js */ `const ${h._importHash}Meta = undefined;`
        : /* js */ `import ${h._importHash}Meta from ${JSON.stringify(h.handler + "?meta")};`
    )
    .join("\n")}
export const handlersMeta = [
  ${handlers
    .map(
      (h) =>
        /* js */ `{ route: ${JSON.stringify(h.route)}, method: ${JSON.stringify(
          h.method?.toLowerCase()
        )}, meta: ${h._importHash}Meta }`
    )
    .join(",\n")}
  ];
        `.trim();
    },
  };
}

function uniqueBy<T>(arr: T[], key: keyof T): T[] {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
}
