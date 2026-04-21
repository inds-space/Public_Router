/**
 * parser.js
 * Parses redirects.txt into a redirect map { sourceHostname: target }.
 *
 * Two target formats are supported:
 *   - Hostname only:  "source.example.com --> target.example.com"
 *     Router will preserve the original path/query and prepend https://.
 *   - Full URL:       "source.example.com --> https://external.com/some/path"
 *     Router will redirect to the exact URL, ignoring the original path/query.
 *
 * Strips comments, validates syntax, rejects duplicates and bad lines.
 */

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$/;
const FULL_URL_RE = /^https?:\/\/.+/;

/**
 * @param {string} raw - Raw contents of redirects.txt
 * @returns {Record<string, { type: "hostname"|"url", target: string }>}
 */
export function parseRedirects(raw) {
  // Strip block comments /* ... */ (including multiline)
  let stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "");

  // Strip line comments // — only at start of line (after optional whitespace)
  // Using ^ with multiline flag so we don't clobber https:// in URL targets
  stripped = stripped.replace(/^\s*\/\/[^\n]*/gm, "");

  const lines = stripped.split("\n");
  const map = Object.create(null);

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

    if (!HOSTNAME_RE.test(source)) {
      throw new Error(`[parser] Line ${i + 1}: invalid source hostname: ${JSON.stringify(source)}`);
    }

    if (source in map) {
      throw new Error(`[parser] Line ${i + 1}: duplicate source hostname: ${JSON.stringify(source)}`);
    }

    if (FULL_URL_RE.test(target)) {
      map[source] = { type: "url", target };
    } else if (HOSTNAME_RE.test(target.toLowerCase())) {
      map[source] = { type: "hostname", target: target.toLowerCase() };
    } else {
      throw new Error(`[parser] Line ${i + 1}: target must be a hostname or a full URL (https://...): ${JSON.stringify(target)}`);
    }
  }

  return map;
}
