/**
 * parser.js
 * Parses redirects.txt into a plain redirect map { sourceHostname: targetHostname }.
 * Strips comments, validates hostname-only syntax, rejects duplicates and bad lines.
 */

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$/;

/**
 * @param {string} raw - Raw contents of redirects.txt
 * @returns {Record<string, string>} - Map of source hostname -> target hostname
 */
export function parseRedirects(raw) {
  // Strip block comments /* ... */ (including multiline)
  let stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "");

  // Strip line comments //
  stripped = stripped.replace(/\/\/[^\n]*/g, "");

  const lines = stripped.split("\n");
  const map = Object.create(null);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split("-->").map((p) => p.trim().toLowerCase());

    if (parts.length !== 2) {
      throw new Error(`[parser] Line ${i + 1}: expected "source --> target", got: ${JSON.stringify(line)}`);
    }

    const [source, target] = parts;

    if (!source || !target) {
      throw new Error(`[parser] Line ${i + 1}: source and target must not be empty`);
    }

    if (!HOSTNAME_RE.test(source)) {
      throw new Error(`[parser] Line ${i + 1}: invalid source hostname: ${JSON.stringify(source)}`);
    }

    if (!HOSTNAME_RE.test(target)) {
      throw new Error(`[parser] Line ${i + 1}: invalid target hostname: ${JSON.stringify(target)}`);
    }

    if (source in map) {
      throw new Error(`[parser] Line ${i + 1}: duplicate source hostname: ${JSON.stringify(source)}`);
    }

    map[source] = target;
  }

  return map;
}
