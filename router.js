/**
 * router.js
 * Core Worker logic. Parses redirects on every request (CF Workers are
 * stateless — module-level caching is inconsistent across isolates).
 * Routes each request: redirect on match, 404.html on miss.
 */

import rawRedirects from "./redirects.txt";
import notFoundHtml from "./404.html";
import { parseRedirects } from "./parser.js";

/**
 * @param {Request} request
 * @returns {Response}
 */
export function handleRequest(request) {
  // Parse on every request so redirects are always fresh (no stale isolate cache).
  const redirects = parseRedirects(rawRedirects);

  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  const entry = redirects[hostname];

  if (entry) {
    let destination;
    if (entry.type === "url") {
      // Full URL target — redirect to specified URL, append original query string if present
      destination = url.search
        ? `${entry.target}${entry.target.includes("?") ? "&" : "?"}${url.search.slice(1)}`
        : entry.target;
    } else {
      // Hostname target — preserve original path + query, prepend https://
      destination = `https://${entry.target}${url.pathname}${url.search}`;
    }
    return Response.redirect(destination, 308);
  }

  return new Response(notFoundHtml, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
