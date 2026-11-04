import { describe, expect, it } from "vitest";
import type { Fastnode } from "fastnode/types";

import app from "../../src/build/virtual/app.ts";

function createFastnodeStub(opts: {
  routes?: boolean;
  routeRules?: boolean;
  routedMiddleware?: boolean;
  globalMiddleware?: boolean;
  plugins?: boolean;
  methodRoutes?: boolean;
}): Fastnode {
  return {
    options: {
      plugins: opts.plugins ? ["plugin.ts"] : [],
      experimental: {},
    },
    routing: {
      routes: {
        hasRoutes: () => opts.routes ?? true,
        routes: opts.methodRoutes
          ? [
              { route: "/foo", method: "post" },
              { route: "/foo", method: "get" },
              { route: "/bar", method: "post" },
              { route: "/**", method: "" },
            ]
          : [{ route: "/**", method: "" }],
      },
      routeRules: { hasRoutes: () => !!opts.routeRules },
      routedMiddleware: { hasRoutes: () => !!opts.routedMiddleware },
      globalMiddleware: opts.globalMiddleware ? [{}] : [],
    },
  } as unknown as Fastnode;
}

describe("virtual/app template", () => {
  it("does not override `~getMiddleware`, so h3 can precompose the middleware chain", () => {
    const template = app(
      createFastnodeStub({ routeRules: true, routedMiddleware: true, globalMiddleware: true })
    ).template();
    expect(template).not.toContain("~getMiddleware");
  });

  it("registers route rules, global and routed middleware in that order", () => {
    const template = app(
      createFastnodeStub({ routeRules: true, routedMiddleware: true, globalMiddleware: true })
    ).template();
    const routeRules = template.indexOf("h3PushMiddleware(h3App, [createRouteRulesMiddleware()])");
    const global = template.indexOf("h3PushMiddleware(h3App, globalMiddleware)");
    const routed = template.indexOf(
      "h3PushMiddleware(h3App, [createRoutedMiddleware(findRoutedMiddleware)])"
    );
    expect(routeRules).toBeGreaterThan(-1);
    expect(global).toBeGreaterThan(routeRules);
    expect(routed).toBeGreaterThan(global);
  });

  it("registers the `cache` rule after global and routed middleware", () => {
    const template = app(
      createFastnodeStub({ routeRules: true, routedMiddleware: true, globalMiddleware: true })
    ).template();
    const routed = template.indexOf(
      "h3PushMiddleware(h3App, [createRoutedMiddleware(findRoutedMiddleware)])"
    );
    const cache = template.indexOf("h3PushMiddleware(h3App, [createCacheRuleMiddleware()])");
    expect(routed).toBeGreaterThan(template.indexOf("h3PushMiddleware(h3App, globalMiddleware)"));
    expect(cache).toBeGreaterThan(routed);
  });

  it("resolves `event.context.routeRules` in `~findRoute`, before any middleware", () => {
    const template = app(createFastnodeStub({ routeRules: true })).template();
    const findRoute = template.indexOf('h3App["~findRoute"] = (event) => {');
    const routeRules = template.indexOf(
      "event.context.routeRules = getRouteRules(event.req.method, event.url.pathname).routeRules;"
    );
    const returnRoute = template.indexOf("return findRoute(event.req.method, event.url.pathname);");
    expect(findRoute).toBeGreaterThan(-1);
    expect(routeRules).toBeGreaterThan(findRoute);
    expect(returnRoute).toBeGreaterThan(routeRules);
  });

  it("still overrides `~findRoute` for route rules when there are no routes", () => {
    const template = app(createFastnodeStub({ routes: false, routeRules: true })).template();
    expect(template).toContain('h3App["~findRoute"] = (event) => {');
    expect(template).toContain("event.context.routeRules = getRouteRules(");
    expect(template).toContain("return undefined;");
    expect(template).not.toContain("findRoute(event.req.method");
  });

  it("only imports the runtime helpers it needs", () => {
    expect(app(createFastnodeStub({ routeRules: true })).template()).toContain(
      'import { createRouteRulesMiddleware, createCacheRuleMiddleware, getRouteRules } from "#fastnode/runtime/app";'
    );
    expect(app(createFastnodeStub({ routedMiddleware: true })).template()).toContain(
      'import { createRoutedMiddleware } from "#fastnode/runtime/app";'
    );
    expect(
      app(createFastnodeStub({ routeRules: true, routedMiddleware: true })).template()
    ).toContain(
      'import { createRouteRulesMiddleware, createRoutedMiddleware, createCacheRuleMiddleware, getRouteRules } from "#fastnode/runtime/app";'
    );
  });

  it("does not compose in the template nor import `h3/rules`", () => {
    const template = app(
      createFastnodeStub({ routeRules: true, routedMiddleware: true, globalMiddleware: true })
    ).template();
    expect(template).toContain('import { H3Core } from "h3";');
    expect(template).not.toContain("composeMiddleware");
    expect(template).not.toContain("h3/rules");
  });

  it("does not import the runtime helpers when nothing is path-dependent", () => {
    const template = app(createFastnodeStub({ globalMiddleware: true })).template();
    expect(template).not.toContain("#fastnode/runtime/app");
    expect(template).not.toContain('~findRoute"] = (event) => {\n    event.context.routeRules');
    expect(template).toContain("h3PushMiddleware(h3App, globalMiddleware)");
  });

  it("falls back to `405` matching only when there are method-specific routes", () => {
    const withMethods = app(createFastnodeStub({ methodRoutes: true })).template();
    expect(withMethods).toContain(
      "return findRoute(event.req.method, event.url.pathname) ?? findMethodNotAllowed(event.req.method, event.url.pathname);"
    );
    expect(withMethods).toContain(
      'const findMethodNotAllowed = createMethodNotAllowedMatcher(findRoute, ["GET","POST"]);'
    );
    const withoutMethods = app(createFastnodeStub({})).template();
    expect(withoutMethods).not.toContain("findMethodNotAllowed");
    expect(withoutMethods).not.toContain("createMethodNotAllowedMatcher");
  });

  it("resets h3's cached dispatcher after plugins ran", () => {
    const reset = "h3ResetDispatcher(app.h3);";
    const withPlugins = app(createFastnodeStub({ plugins: true })).template();
    const plugins = withPlugins.indexOf("for (let i = 0; i < plugins.length; i++)");
    expect(plugins).toBeGreaterThan(-1);
    expect(withPlugins.indexOf(reset)).toBeGreaterThan(plugins);
    expect(app(createFastnodeStub({})).template()).not.toContain(reset);
  });

  it("only imports the async plugins runtime when there are plugins", () => {
    const withPlugins = app(createFastnodeStub({ plugins: true })).template();
    expect(withPlugins).toContain(`from "#fastnode/runtime/async-plugins"`);
    expect(app(createFastnodeStub({})).template()).not.toContain("async-plugins");
  });
});
