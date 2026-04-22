# Router

Hostname redirects at the Cloudflare edge, configured by a text file, with no dashboard clicks and no hardcoded routes.

---

## Why Router?

**Cloudflare dashboard redirect rules** have no git history, no code you can review, and no SSL support for second-level subdomains (e.g. `sub.domain.example.com`) on the Free plan.

**Bulk redirect rules** share the same problems and add a clunky UI on top.

**Workers with hardcoded routes** mix config and logic in the same file. Every redirect change is a code change and a redeploy.

**Router** keeps redirect rules in `redirects.txt`, domains in `wrangler.toml`, and runs the lookup at the Cloudflare edge with zero origin servers. Config changes are a text edit and a `wrangler deploy`. The git history is the audit log.

---

## Overview

Router is a Cloudflare Worker that maps source hostnames to redirect targets. On every request, the Worker parses `redirects.txt` and performs a lookup against the incoming hostname. The file is bundled at deploy time, so parsing is a pure in-memory string operation with no I/O. There is no caching layer and no shared state across isolates or regions. Each request is fully stateless.

Unmatched hostnames return a clean `404.html` page with dark mode and a Back to Home button.

Two target formats are supported:

```
source.example.com --> target.example.com
source.example.com --> https://full.url/path
```

---

## Features

- **Six files, ~200 lines.** `index.js`, `router.js`, `parser.js`, `redirects.txt`, `404.html`, `wrangler.toml`. Nothing hidden, nothing abstracted away.
- **Unlimited custom domains.** Add as many `[[routes]]` entries to `wrangler.toml` as you need.
- **Plain-text config.** All redirect rules live in `redirects.txt`. No database, no API calls, no dashboard state.
- **Fail-fast validation.** The parser catches invalid hostnames, missing separators, duplicate sources, and invalid targets at startup. A bad config fails the deploy, not a live request.
- **308 redirects.** All redirects use HTTP 308 Permanent Redirect, which preserves the request method.
- **Two target modes.** Hostname targets preserve the original path and query string. Full URL targets fix the destination path and append the original query string only.
- **Comment support.** `redirects.txt` accepts `//` single-line and `/* */` block comments.
- **Custom 404 fallback.** Unmatched hostnames get a clean dark-mode 404 page.
- **No runtime dependencies.** Plain JavaScript, no npm packages.
- **Fully stateless.** No module-level caching. No shared state between isolates or Cloudflare regions. Every request parses fresh from the bundled file.

---

## How It Works

**Request lifecycle:**

1. `index.js` receives the incoming request and calls `handleRequest`
2. `router.js` parses `redirects.txt` and builds the redirect map for this request
3. The hostname is extracted and matched against the map
4. Matched: returns a `308` redirect
5. Unmatched: returns `404.html` with status `404`

**Deploy lifecycle:**

1. Wrangler bundles `redirects.txt` and `404.html` as static text modules
2. On each request, `router.js` passes the raw text to `parser.js`
3. `parser.js` validates every line and returns the redirect map
4. The map is used for the lookup and discarded after the response

No state persists between requests. No isolate-level cache. This is intentional: Cloudflare Workers run across hundreds of global PoPs in independent isolates with no shared memory. A module-level cache would not be consistent across regions and would silently diverge after cold starts. Parsing on every request from the bundled static string is cheap and correct.

**Validation rejects:**

- Invalid source hostnames
- Lines missing the ` --> ` separator
- Duplicate source hostnames
- Targets that are neither valid hostnames nor full URLs

---

## Project Structure

```
/
├── index.js        # Worker entrypoint
├── router.js       # Redirect lookup and response handling
├── parser.js       # redirects.txt parser and validator
├── redirects.txt   # Redirect rules
├── 404.html        # Custom not-found response
└── wrangler.toml   # Worker name, entry, and custom domain config
```

---

## Configuration Reference

### Redirect Syntax

```
source.example.com --> target.example.com
source.example.com --> https://full.url/path
```

| Field | Rules |
|---|---|
| Source | Valid hostname. One per line. No duplicates. |
| Separator | Must be ` --> ` (space, two hyphens, right angle bracket, space). |
| Target | Either a valid hostname or a full URL starting with `https://`. |

Hostnames are normalized to lowercase. Blank lines are ignored.

### Target Modes

**Hostname target** preserves the original path and query string.

```
old.example.com --> www.example.com
```

Request: `https://old.example.com/blog/post?ref=x`
Redirects to: `https://www.example.com/blog/post?ref=x`

**Full URL target** fixes the destination path and appends the original query string only.

```
go.example.com --> https://docs.example.com/start
```

Request: `https://go.example.com/anything?ref=x`
Redirects to: `https://docs.example.com/start?ref=x`

The original path is not preserved for full URL targets.

### Comment Syntax

```
// Single-line comment

/*
  Multi-line
  block comment
*/

example.com --> www.example.com
```

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/inds-space/Public_Router.git
cd Public_Router
```

### 2. Add your redirect rules

Edit `redirects.txt`:

```
example.com --> www.example.com
old.example.com --> www.example.com
go.example.com --> https://docs.example.com/start
```

### 3. Add matching custom domains

Edit `wrangler.toml`:

```toml
name = "router"
main = "index.js"
compatibility_date = "2024-09-23"

[[routes]]
pattern = "example.com"
custom_domain = true

[[routes]]
pattern = "old.example.com"
custom_domain = true

[[routes]]
pattern = "go.example.com"
custom_domain = true
```

Every source hostname in `redirects.txt` needs a matching `[[routes]]` entry.

### 4. Authenticate Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 5. Deploy

```bash
wrangler deploy
```

---

## Local Development

Start a local dev server:

```bash
wrangler dev
```

Test with a custom `Host` header:

```bash
curl -H "Host: old.example.com" http://localhost:8787/blog/post?ref=x
```

Expected response: `308` redirect to `https://www.example.com/blog/post?ref=x`.

---

## Deployment

### Prerequirements

0. [Git](https://git-scm.com/)/Github CLI Installed 
1. Wrangler Installed 
2. Cloudflare with full DNS Setup

### Then follow those steps:

0. Clone the repo with `git clone https://github.com/inds-space/Public_Router` 
1. Update `redirects.txt` with your redirect rules
2. Update `wrangler.toml` with your domains
3. Check Cloudflare DNS for conflicting A, AAAA, or CNAME records on affected domains. Remove them before assigning as Worker custom domains.
4. If not authenticated with Wrangler, authenticate with `wrangler login`
5. Run `wrangler deploy`

Enjoy your brand new redirects system and star the repo to not miss any updates!

Cloudflare handles TLS certificate issuance for custom domains. Certificates may take ~15-30 mins to become active after first setup.

---

## Troubleshooting

### Deploy fails with a parser error

The Worker validates `redirects.txt` at startup. The error message from `wrangler deploy` will identify the offending line. Common causes:

- A line missing the ` --> ` separator
- An invalid hostname in the source field (contains a path or protocol)
- A duplicate source hostname
- A target that is neither a hostname nor a full URL starting with `https://`

### Redirect returns 404

All three must be true for a redirect to work:

1. The hostname is in `redirects.txt`
2. The hostname has a matching `[[routes]]` entry in `wrangler.toml`
3. The custom domain is fully active in Cloudflare (check the Workers dashboard)

If the custom domain was just added, wait a few minutes for the certificate to provision.

### Redirect target is wrong

Check which target mode the rule uses:

- Hostname target: preserves the full original path and query string
- Full URL target: locks the destination path, appends query string only

If you used a full URL target and expected path preservation, change the target to a bare hostname.

---

## Production Example

Router currently powers `inds.space`. A sample of active rules:

```
// Apex to www
inds.space --> www.inds.space

// Discord Links
my.dc.inds.space --> my.discord.inds.space
my.discord.inds.space --> https://discord.com/users/1176951696048541827

// VS Code tunnel shortlink
code.inds.space --> https://vscode.dev/tunnel/hacktheworld/
```

This covers both target modes in real use: hostname-to-hostname for the apex redirect and vanity alias, full URL for external service destinations. One Worker handles all of them from a single deploy.

---

## License

[MIT](LICENSE)
