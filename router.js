/**
 * router.js
 * Core Worker logic. Parses redirects once on startup, then routes every
 * incoming request: redirect on match, 404.html on miss.
 */

import rawRedirects from "./redirects.txt";
import notFoundHtml from "./404.html";
import { parseRedirects } from "./parser.js";

// Parse once at module load time (Worker startup). Throws hard on bad config.
const REDIRECTS = parseRedirects(rawRedirects);

/**
 * @param {Request} request
 * @returns {Response}
 */
export function handleRequest(request) {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  const entry = REDIRECTS[hostname];

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
