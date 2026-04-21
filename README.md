# DO NOT USE THIS RN.

### Its breaking under prod. I'm actively investigating this issue.
Please bear with me. 

Caused Downtime for ~1 minute
[IND's Soace Status](https://status.inds.space/)

# Router

**Zero-latency domain redirects. No server. No maintenance. Just traffic going exactly where it should.**

Every domain you own is a liability if it's not working for you. Forgotten apex domains that don't forward. Legacy subdomains that 404. Short links that go nowhere. Router fixes all of that with a single config file and a Cloudflare Worker that runs in milliseconds at the edge — worldwide.

You manage redirects in plain text. Router handles the rest.

---

## Why Router

- **One file to rule them all.** Every redirect lives in `redirects.txt`. Add a line, deploy, done. No dashboards, no UI, no databases.
- **Edge-native speed.** Runs as a Cloudflare Worker. Responses come from the nearest edge node to your visitor — not a server in a single region.
- **Zero cold-start overhead.** The redirect map is parsed once at Worker startup and cached in memory for the lifetime of the isolate. Every subsequent request is a plain object lookup.
- **Bulletproof config parsing.** The parser validates every line, rejects duplicates, and throws hard on bad input — so your redirect config never silently breaks.
- **Path and query preserved.** A visitor hitting `old.yourdomain.com/blog/post?ref=twitter` lands on `www.yourdomain.com/blog/post?ref=twitter`. Nothing gets lost.
- **Clean 404 fallback.** Anything that doesn't match a redirect gets a polished custom error page, not a raw Cloudflare error screen.
- **Six files. No framework. No nonsense.**

---

## Project Structure

```
/
├─ index.js        # Worker entrypoint — tiny by design
├─ router.js       # Runtime logic: match hostname, redirect or 404
├─ parser.js       # Strict redirects.txt parser
├─ redirects.txt   # Your redirect config — the only file you edit day-to-day
├─ 404.html        # Custom not-found page
└─ wrangler.toml   # Cloudflare Worker deployment config
```

---

## Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (for Wrangler)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed and authenticated

```bash
npm install -g wrangler
wrangler login
```

### 2. Configure your redirects

Open `redirects.txt` and add your redirects:

```
inds.space --> www.inds.space
old.inds.space --> www.inds.space
go.inds.space --> www.inds.space
```

That's it. No protocols, no paths, no quotes. Raw hostnames only.

### 3. Update wrangler.toml

Replace `inds.space` with your actual domain:

```toml
name = "router"
main = "index.js"
compatibility_date = "2024-09-23"

routes = [
  { pattern = "yourdomain.com/*",   zone_name = "yourdomain.com" },
  { pattern = "*.yourdomain.com/*", zone_name = "yourdomain.com" },
]
```

### 4. Configure DNS

In your Cloudflare DNS dashboard, add two proxied dummy records pointing to any valid IP (e.g. `192.0.2.1`):

| Type | Name | Content    | Proxy |
|------|------|------------|-------|
| A    | @    | 192.0.2.1  | On    |
| A    | *    | 192.0.2.1  | On    |

The Worker intercepts all traffic before it ever reaches the IP — the IP is just a placeholder to satisfy Cloudflare's DNS requirement.

### 5. Deploy

```bash
wrangler deploy
```


---

## redirects.txt Reference

This is the single source of truth for all redirect behavior. The Worker reads this file at startup — nothing is hardcoded anywhere else.

### Syntax

```
<source-hostname> --> <target-hostname>
```

- One redirect per line
- Raw hostnames only — no `https://`, no paths, no query strings
- Both sides must be valid, fully-qualified hostnames with at least one dot
- Everything is lowercased automatically

### Comments

Both comment styles are supported:

```
// This is a single-line comment

/*
  This is a
  multi-line block comment
*/
```

### Example

```
// Apex to www
inds.space --> www.inds.space

// Legacy subdomain
old.inds.space --> www.inds.space

/* Short link domain — remove after rebrand */
go.inds.space --> www.inds.space
```

### Rules enforced by the parser

| Rule | Behavior |
|------|----------|
| Invalid syntax (not `a --> b`) | Throws an error — deploy will fail |
| Invalid hostname (e.g. `https://example.com`) | Throws an error |
| Duplicate source hostname | Throws an error |
| Empty source or target | Throws an error |
| Blank lines and comments | Silently ignored |

Errors surface at Worker startup, which means a bad `redirects.txt` will cause your deploy to fail loudly before it ever reaches production.

---

## How It Works

### Request lifecycle

```
Incoming request
  └─ index.js         exports default fetch handler
       └─ router.js   extracts hostname, looks up REDIRECTS map
            ├─ Match found  →  301 redirect to https://<target><path><query>
            └─ No match     →  404.html with status 404
```

### Startup (module load)

When the Worker isolate initializes, `router.js` runs its top-level module code:

```js
const REDIRECTS = parseRedirects(rawRedirects);
```

`rawRedirects` is the contents of `redirects.txt`, bundled as a text module by Wrangler at build time. `parseRedirects` runs once and the result is cached in the isolate's memory for every subsequent request — there's no file I/O at request time.

### Redirect behavior

Matching is exact hostname-only. Given a request to `https://old.inds.space/blog/post?ref=twitter`:

1. Hostname extracted: `old.inds.space`
2. Lookup in `REDIRECTS`: found → `www.inds.space`
3. Destination built: `https://www.inds.space/blog/post?ref=twitter`
4. Response: `301 Moved Permanently`

Pathname and search string are always preserved verbatim.

### 404 behavior

If no redirect matches, the Worker returns `404.html` with:
- HTTP status `404`
- `Content-Type: text/html; charset=utf-8`

---

## File Reference

### `index.js`

The Worker entrypoint. Intentionally kept to the absolute minimum — just imports `handleRequest` from `router.js` and passes the request through. Never add logic here.

```js
import { handleRequest } from "./router.js";

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  },
};
```

### `router.js`

Contains all runtime logic. Imports `redirects.txt` and `404.html` as static text modules (bundled at build time by Wrangler). Parses the redirect map once at module load. Exports `handleRequest`.

Key behaviors:
- `new URL(request.url)` — parses hostname, pathname, and search
- `REDIRECTS[hostname]` — O(1) object property lookup
- `Response.redirect(destination, 301)` — permanent redirect
- Fallback returns raw HTML string with status 404

### `parser.js`

Pure function. Takes the raw string contents of `redirects.txt`, returns a plain `Object.create(null)` map with no prototype chain.

Processing steps in order:
1. Strip `/* */` block comments (handles multiline with `[\s\S]*?`)
2. Strip `//` line comments
3. Split on `\n`
4. Trim each line, skip blanks
5. Split on `-->`, expect exactly 2 parts
6. Lowercase both sides
7. Validate each side against `HOSTNAME_RE`
8. Check for duplicate sources
9. Write to map and continue

`HOSTNAME_RE` pattern: `/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$/`

Accepts labels that start and end with alphanumerics, contain hyphens internally, and require at least one dot (i.e. a real FQDN, not a bare label).

### `wrangler.toml`

Minimal Cloudflare Worker config. Update `name`, the `zone_name`, and the route patterns to match your domain before deploying.

```toml
name = "router"
main = "index.js"
compatibility_date = "2024-09-23"

routes = [
  { pattern = "inds.space/*",   zone_name = "inds.space" },
  { pattern = "*.inds.space/*", zone_name = "inds.space" },
]
```

The two routes cover:
- The apex domain (`inds.space`)
- All subdomains (`*.inds.space`)

### `404.html`

Standalone HTML page served for unmatched hostnames. Self-contained — no external CSS, no JavaScript, no fonts. The "Back to website" link points to `https://www.inds.space` — update this if your canonical home URL changes.

---

## Wrangler Module Rules

Wrangler 3+ typically auto-detects `.txt` and `.html` as text modules. If you get a bundling error on deploy, add this to `wrangler.toml`:

```toml
[[rules]]
type = "Text"
globs = ["**/*.txt", "**/*.html"]
```

---

## Local Development

```bash
wrangler dev
```

This starts a local dev server (default: `http://localhost:8787`). You can test redirects by hitting the local URL with a custom `Host` header:

```bash
curl -H "Host: inds.space" http://localhost:8787/some/path
```

---

## Adding or Changing Redirects

1. Edit `redirects.txt`
2. Run `wrangler deploy`

No code changes needed. The parser re-runs at every deploy and will throw if anything is wrong before the Worker goes live.

---

## License

MIT
