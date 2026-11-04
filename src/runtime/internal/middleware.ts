import type { H3Route, MatchedRoute, Middleware } from "h3";
import { composeMiddleware, HTTPError } from "h3";
import type { MatchedRouteRules, ResolvedRouteRules } from "h3/rules";
import { createMatcherFromFind, memoizeRouteRulesMatcher } from "h3/rules";
import { findRouteRules } from "#fastnode/virtual/routing";

// ---------------------------------------------------------------------------
// Route rule matching
//
// Resolves route rules (redirect, headers, cors, cache, ...) for a method and
// pathname. Results are memoized and shared, so treat them as read-only.
// ---------------------------------------------------------------------------

let _matchRouteRules: ReturnType<typeof createMatcherFromFind> | undefined;

export function getRouteRules(
  method: string,
  pathname: string
): { routeRules: ResolvedRouteRules } {
  return matchRouteRules(method, pathname);
}

function matchRouteRules(
  method: string,
  pathname: string
): {
  routeRules: ResolvedRouteRules;
  matchedRules: MatchedRouteRules;
  routeRuleMiddleware: Middleware[];
} {
  return (_matchRouteRules ??= memoizeRouteRulesMatcher(createMatcherFromFind(findRouteRules)))(
    method,
    pathname
  );
}

// ---------------------------------------------------------------------------
// Route rule chain resolution
//
// Composes matched route-rule middleware into chains cached by middleware
// identity (bounded by distinct match combinations rather than request
// pathnames). `cache` has the highest `order` and is always last.
// ---------------------------------------------------------------------------

const kCacheRule: unique symbol = /* @__PURE__ */ Symbol("fastnode.cacheRule");

type CacheRuleCarrier = { [kCacheRule]?: Middleware };

const _routeRuleChains = /* @__PURE__ */ new WeakMap<Middleware[], RouteRuleChains>();

function resolveRouteRuleChains(method: string, pathname: string): RouteRuleChains {
  const { matchedRules, routeRuleMiddleware } = matchRouteRules(method, pathname);
  if (routeRuleMiddleware.length === 0) {
    return {};
  }
  let chains = _routeRuleChains.get(routeRuleMiddleware);
  if (!chains) {
    const hasCache = !!matchedRules.cache?.handler;
    const rules = hasCache ? routeRuleMiddleware.slice(0, -1) : routeRuleMiddleware;
    chains = {
      rules: rules.length > 0 ? composeMiddleware(rules) : undefined,
      cache: hasCache ? routeRuleMiddleware.at(-1) : undefined,
    };
    _routeRuleChains.set(routeRuleMiddleware, chains);
  }
  return chains;
}

type RouteRuleChains = {
  rules?: ReturnType<typeof composeMiddleware>;
  cache?: Middleware;
};

// ---------------------------------------------------------------------------
// Middleware factories
// ---------------------------------------------------------------------------

/**
 * Middleware that runs the route-rule middleware (`redirect`, `headers`,
 * `cors`, ...) matched for the current request, except `cache` (see
 * `createCacheRuleMiddleware`). The composed chain is cached per memoized
 * match, so each distinct match is composed once.
 *
 * `event.context.routeRules` is assigned earlier, from `~findRoute`, so it is
 * populated for every middleware regardless of its position in the chain.
 */
export function createRouteRulesMiddleware(): Middleware {
  const middleware: Middleware = (event, next) => {
    const { rules, cache } = resolveRouteRuleChains(event.req.method, event.url.pathname);
    if (cache) {
      (event as CacheRuleCarrier)[kCacheRule] = cache;
    }
    return rules ? rules(event, next as any) : next();
  };
  return markUntraced(middleware);
}

/**
 * Middleware that runs the `cache` route rule matched for the current request.
 * The rule dispatches the matched route handler itself, so it is registered
 * after global and routed middleware for them to run on cached routes too.
 *
 * The rule is matched by `createRouteRulesMiddleware`, on the same pathname as
 * the other rules, even if a middleware rewrites `event.url` in between.
 */
export function createCacheRuleMiddleware(): Middleware {
  const middleware: Middleware = (event, next) => {
    const cache = (event as CacheRuleCarrier)[kCacheRule];
    return cache ? cache(event, next) : next();
  };
  return markUntraced(middleware);
}

/**
 * Middleware that runs the routed (`server/middleware/**` with a route)
 * middleware matched for the current request. Chains are cached by the
 * identity of the matched handlers.
 */
export function createRoutedMiddleware(
  findRoutedMiddleware: (method: string, pathname: string) => { data: Middleware }[]
): Middleware {
  const root: RoutedChainNode = { children: new Map() };
  const middleware: Middleware = (event, next) => {
    const matched = findRoutedMiddleware(event.req.method, event.url.pathname);
    if (matched.length === 0) {
      return next();
    }
    let node = root;
    for (const entry of matched) {
      let child = node.children.get(entry);
      if (!child) {
        child = { children: new Map() };
        node.children.set(entry, child);
      }
      node = child;
    }
    return (node.chain ??= composeMiddleware(matched.map((r) => r.data)))(event, next as any);
  };
  return markUntraced(middleware);
}

// `~findRoute` fallback: `405` with an `Allow` header when the path is routed
// only for other `methods` (a method-agnostic route would have matched already).
export function createMethodNotAllowedMatcher(
  findRoute: (method: string, pathname: string) => unknown,
  methods: string[]
): (method: string, pathname: string) => MatchedRoute<H3Route> | undefined {
  return (method, pathname) => {
    let allow: string | undefined;
    for (const m of methods) {
      if (m !== method && findRoute(m, pathname)) {
        allow = allow ? `${allow}, ${m}` : m;
      }
    }
    if (!allow) {
      return;
    }
    // Returned rather than thrown: h3 handles it the same, without the unwinding cost
    return {
      data: {
        handler: () =>
          new HTTPError({
            status: 405,
            statusText: "Method Not Allowed",
            message: `Method ${method} is not allowed for ${pathname} (allowed: ${allow})`,
            headers: { allow },
          }),
      },
    };
  };
}

type RoutedChainNode = {
  children: Map<object, RoutedChainNode>;
  chain?: ReturnType<typeof composeMiddleware>;
};

// Fastnode's own wrappers are not user middleware: opt them out of `h3/tracing`
// so they do not add anonymous spans around the whole downstream chain.
function markUntraced(middleware: Middleware): Middleware {
  (middleware as Middleware & { __traced__?: boolean }).__traced__ = true;
  return middleware;
}
