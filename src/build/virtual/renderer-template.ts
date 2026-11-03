import type { Fastnode } from "fastnode/types";
import { readFile } from "node:fs/promises";
import { hasTemplateSyntax, compileTemplateToString, RENDER_CONTEXT_KEYS } from "rendu";

export default function rendererTemplate(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/renderer-template",
    template: async () => {
      const template = fastnode.options.renderer?.template;
      if (typeof template !== "string") {
        // No template
        return /* js */ `
            export const rendererTemplate = () => '<!-- renderer.template is not set -->';
            export const rendererTemplateFile = undefined;
            export const isStaticTemplate = true;`;
      }
      if (fastnode.options.dev) {
        // Development
        return /* js */ `
            import { readFile } from 'node:fs/promises';
            export async function rendererTemplate() {
              try {
                return await readFile(${JSON.stringify(template)}, "utf8");
              } catch (error) {
                // The runner may lack fs access (e.g. workerd): ask the host (set by the dev entry)
                if (!globalThis.__fastnode_renderer_template__) throw error;
                return globalThis.__fastnode_renderer_template__().catch((hostError) => {
                  throw Object.assign(error, { cause: hostError });
                });
              }
            }
            export const rendererTemplateFile = ${JSON.stringify(template)};
            export const isStaticTemplate = ${JSON.stringify(fastnode.options.renderer?.static)};
            `;
      } else {
        // Production
        const html = await readFile(template, "utf8");
        const isStatic = fastnode.options.renderer?.static ?? !hasTemplateSyntax(html);
        if (isStatic) {
          return /* js */ `
              import { HTTPResponse } from "h3";
              export const rendererTemplate = () => new HTTPResponse(${JSON.stringify(html)}, { headers: { "content-type": "text/html; charset=utf-8" } });
            `;
        } else {
          const template = compileTemplateToString(html, {
            contextKeys: [...RENDER_CONTEXT_KEYS],
          });
          return /* js */ `
            import { renderToResponse } from '#fastnode/runtime/rendu'
            import { fetch, serverFetch } from 'fastnode/app'
            ${fastnode.options.builder === "vite" ? `import { fetchViteEnv } from "fastnode/vite/runtime"` : ""}
            const context = { fetch, serverFetch${fastnode.options.builder === "vite" ? ", fetchViteEnv" : ""} }
            const template = ${template};
            export const rendererTemplate = (request) => renderToResponse(template, { request, context })
            `;
        }
      }
    },
  };
}
