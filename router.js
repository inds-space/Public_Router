/**
 * router.js
 * Core Worker logic. Parses redirects on every request (CF Workers are
 * stateless — module-level caching is inconsistent across isolates).
 * Routes each request: redirect on match, 404.html on miss.
 */

import rawRedirects from "./redirects.txt";
import notFoundHtml from "./404.html";
import { parseRedirects } from "./parser.js";
import { resolveRedirect } from "./redirector.js";

/**
 * @param {Request} request
 * @returns {Response}
 */
export function handleRequest(request) {
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
