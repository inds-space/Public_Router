/**
 * parser.js
 * Parses redirects.txt into hostname and path redirect maps.
 *
 * Source formats:
 *   - Hostname only:  "source.example.com --> target.example.com"
 *   - Exact path:     "source.example.com/path --> target.example.com/path"
 *   - Wildcard path:  "source.example.com/path/* --> target.example.com/base/*"
 *
 * Target formats:
 *   - Hostname only:  "source.example.com --> target.example.com"
 *     Hostname-only sources preserve the original path/query and prepend http://.
 *   - URL:            "source.example.com/path --> target.example.com/some/path"
 *     Router will redirect to the exact URL and prepend http:// if omitted.
 *
 * Strips comments, validates syntax, rejects duplicates and bad lines.
 */

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$/;
const FULL_URL_RE = /^https?:\/\//i;

function createPathBucket() {
  return {
    exact: Object.create(null),
    wildcards: [],
  };
}

function parseSource(source, lineNumber) {
  if (FULL_URL_RE.test(source)) {
    throw new Error(`[parser] Line ${lineNumber}: source must not include a protocol: ${JSON.stringify(source)}`);
  }

  const slashIndex = source.indexOf("/");
  const hostname = (slashIndex === -1 ? source : source.slice(0, slashIndex)).toLowerCase();
  const path = slashIndex === -1 ? null : source.slice(slashIndex);

  if (!HOSTNAME_RE.test(hostname)) {
    throw new Error(`[parser] Line ${lineNumber}: invalid source hostname: ${JSON.stringify(hostname)}`);
  }

  if (path === null) {
    return { hostname, path: null, wildcard: false };
  }

  if (!path.startsWith("/") || path.includes("?") || path.includes("#") || /\s/.test(path)) {
    throw new Error(`[parser] Line ${lineNumber}: invalid source path: ${JSON.stringify(path)}`);
  }

  const wildcard = path.endsWith("/*");
  if (path.includes("*") && !wildcard) {
    throw new Error(`[parser] Line ${lineNumber}: wildcard sources must end with "/*": ${JSON.stringify(path)}`);
  }

  return { hostname, path, wildcard };
}

function normalizeTarget(target, source, lineNumber) {
  if (source.path === null && !FULL_URL_RE.test(target) && HOSTNAME_RE.test(target.toLowerCase())) {
    return { type: "hostname", target: target.toLowerCase(), targetHasWildcard: false };
  }

  const normalized = FULL_URL_RE.test(target) ? target : `http://${target}`;

  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(`[parser] Line ${lineNumber}: invalid target URL: ${JSON.stringify(target)}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`[parser] Line ${lineNumber}: target URL must use http or https: ${JSON.stringify(target)}`);
  }

  if (!HOSTNAME_RE.test(url.hostname.toLowerCase())) {
    throw new Error(`[parser] Line ${lineNumber}: invalid target hostname: ${JSON.stringify(url.hostname)}`);
  }

  return {
    type: "url",
    target: url.toString(),
    targetHasWildcard: url.pathname.endsWith("/*"),
  };
}

/**
 * @param {string} raw - Raw contents of redirects.txt
 * @returns {{
 *   hostnames: Record<string, { type: "hostname"|"url", target: string, targetHasWildcard: boolean }>,
 *   paths: Record<string, {
 *     exact: Record<string, { type: "url", target: string, targetHasWildcard: boolean, wildcard: false }>,
 *     wildcards: Array<{ type: "url", target: string, targetHasWildcard: boolean, wildcard: true, sourcePath: string, sourcePrefix: string }>
 *   }>
 * }}
 */
export function parseRedirects(raw) {
  // Strip block comments /* ... */ (including multiline)
  let stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "");

  // Strip line comments // — only at start of line (after optional whitespace)
  // Using ^ with multiline flag so we don't clobber https:// in URL targets
  stripped = stripped.replace(/^\s*\/\/[^\n]*/gm, "");

  const lines = stripped.split("\n");
  const redirects = {
    hostnames: Object.create(null),
    paths: Object.create(null),
  };
  const seenSources = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split("-->").map((p) => p.trim());

    if (parts.length !== 2) {
      throw new Error(`[parser] Line ${i + 1}: expected "source --> target", got: ${JSON.stringify(line)}`);
    }

    const source = parts[0].toLowerCase();
    const target = parts[1];

    if (!source || !target) {
      throw new Error(`[parser] Line ${i + 1}: source and target must not be empty`);
    }

    const sourceParts = parseSource(source, i + 1);
    const sourceKey = sourceParts.path === null ? sourceParts.hostname : `${sourceParts.hostname}${sourceParts.path}`;
    if (seenSources.has(sourceKey)) {
      throw new Error(`[parser] Line ${i + 1}: duplicate source: ${JSON.stringify(sourceKey)}`);
    }
    seenSources.add(sourceKey);

    const entry = normalizeTarget(target, sourceParts, i + 1);
    if (sourceParts.path === null) {
      redirects.hostnames[sourceParts.hostname] = entry;
    } else {
      const bucket = redirects.paths[sourceParts.hostname] || createPathBucket();
      redirects.paths[sourceParts.hostname] = bucket;

      const pathEntry = {
        ...entry,
        wildcard: sourceParts.wildcard,
        sourcePath: sourceParts.path,
        sourcePrefix: sourceParts.wildcard ? sourceParts.path.slice(0, -1) : sourceParts.path,
      };

      if (sourceParts.wildcard) {
        bucket.wildcards.push(pathEntry);
      } else {
        bucket.exact[sourceParts.path] = pathEntry;
      }
    }
  }

  for (const bucket of Object.values(redirects.paths)) {
    bucket.wildcards.sort((a, b) => b.sourcePrefix.length - a.sourcePrefix.length);
  }

  return redirects;
}
