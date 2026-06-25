/**
 * router.js
 * Core Worker logic. Parses redirects on every request (CF Workers are
 * stateless - module-level caching is inconsistent across isolates).
 * Routes each request: redirect on match, 404.html on miss.
 */

import { parseRedirects } from "./parser.js";

function appendSearch(target, search) {
  if (!search) return target;

  const url = new URL(target);
  const incoming = new URLSearchParams(search);
  for (const [key, value] of incoming) {
    url.searchParams.append(key, value);
  }
  return url.toString();
}

function appendWildcardSuffix(target, suffix, targetHasWildcard) {
  const url = new URL(target);
  if (targetHasWildcard) {
    url.pathname = `${url.pathname.slice(0, -1)}${suffix}`;
  } else {
    const basePath = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    url.pathname = `${basePath}${suffix}`;
  }
  return url.toString();
}

function findRedirect(redirects, url) {
  const hostname = url.hostname.toLowerCase();
  const pathBucket = redirects.paths[hostname];

  if (pathBucket) {
    const exact = pathBucket.exact[url.pathname];
    if (exact) return { entry: exact, suffix: "" };

    for (const wildcard of pathBucket.wildcards) {
      if (url.pathname.startsWith(wildcard.sourcePrefix)) {
        return {
          entry: wildcard,
          suffix: url.pathname.slice(wildcard.sourcePrefix.length),
        };
      }
    }
  }

  const hostnameEntry = redirects.hostnames[hostname];
  return hostnameEntry ? { entry: hostnameEntry, suffix: "" } : null;
}

function buildDestination(entry, url, suffix = "") {
  if (entry.type === "hostname") {
    return `http://${entry.target}${url.pathname}${url.search}`;
  }

  const target = entry.wildcard
    ? appendWildcardSuffix(entry.target, suffix, entry.targetHasWildcard)
    : entry.target;

  return appendSearch(target, url.search);
}

export function resolveRedirect(redirects, requestUrl) {
  const url = new URL(requestUrl);
  const match = findRedirect(redirects, url);
  if (!match) return null;

  return buildDestination(match.entry, url, match.suffix);
}

/**
 * @param {Request} request
 * @param {string} rawRedirects
 * @param {string} notFoundHtml
 * @returns {Response}
 */
export function handleRequest(request, rawRedirects, notFoundHtml) {
  // Parse on every request so redirects are always fresh (no stale isolate cache).
  const redirects = parseRedirects(rawRedirects);
  const destination = resolveRedirect(redirects, request.url);

  if (destination) {
    return Response.redirect(destination, 308);
  }

  return new Response(notFoundHtml, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
