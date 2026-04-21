# Router

**Zero-latency hostname redirects at the Cloudflare edge.**

Every domain you own is a liability if it's not pointed somewhere. Router fixes forgotten apex domains, legacy subdomains, and short links — all from a single plain-text config file deployed as a Cloudflare Worker. No server, no database, no framework.

Live on [inds.space](https://www.inds.space) — routing `inds.space`, `biz.inds.space`, `go.inds.space`, and more.

## Features

- **One file.** Every redirect lives in `redirects.txt`. Add a line, deploy, done.
- **Edge-native speed.** Runs as a Cloudflare Worker — responses come from the nearest PoP to your visitor, not a single-region server.
- **Zero request-time overhead.** The redirect map is parsed once at Worker startup and cached in memory. Every request is a plain object lookup.
- **Strict validation.** Invalid hostnames, duplicates, and malformed lines fail the deploy loudly before anything reaches production.
- **Path and query string preserved.** `old.example.com/blog/post?ref=twitter` lands on `www.example.com/blog/post?ref=twitter`.
- **Custom 404 fallback.** Unmatched hostnames get a clean error page instead of a raw Cloudflare screen.
- **Six files. Zero dependencies.**

## Project structure

```
/
├── index.js        # Worker entrypoint
├── router.js       # Request handling: hostname lookup, redirect or 404
├── parser.js       # Strict parser for redirects.txt
├── redirects.txt   # Your redirect config — the only file you touch day-to-day
├── 404.html        # Custom not-found page
└── wrangler.toml   # Cloudflare Worker deployment config
```

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with at least one domain added and proxied
- [Node.js](https://nodejs.org/) v18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed and authenticated

```bash
npm install -g wrangler
wrangler login
```

## Quick start

### 1. Clone the repo

```bash
git clone https://github.com/your-username/router.git
cd router
```

### 2. Add your redirects

Edit `redirects.txt`:

```
// Apex to www
example.com --> www.example.com

// Legacy subdomain
old.example.com --> www.example.com

// Short link domain
go.example.com --> www.example.com
```

See [redirects.txt reference](#redirectstxt-reference) for full syntax.

### 3. Update wrangler.toml

Replace the zone and route entries with your own domain:

```toml
name = "router"
main = "index.js"
compatibility_date = "2024-09-23"

routes = [
  { pattern = "example.com/*",     zone_name = "example.com" },
  { pattern = "old.example.com/*", zone_name = "example.com" },
  { pattern = "go.example.com/*",  zone_name = "example.com" },
]
```

> **One route per redirect source.** Avoid wildcard routes (`*.example.com/*`) unless you
> intend to intercept every subdomain. A wildcard captures all traffic on the zone —
> subdomains with their own services will 404 until the wildcard is removed.
> See [Route configuration](#route-configuration).

### 4. Add DNS records

Each route needs a proxied DNS record. The IP is just a placeholder — the Worker intercepts
traffic before it reaches the origin.

| Type | Name              | Content   | Proxy status |
|------|-------------------|-----------|--------------|
| A    | `@`               | 192.0.2.1 | Proxied      |
| A    | `old`             | 192.0.2.1 | Proxied      |
| A    | `go`              | 192.0.2.1 | Proxied      |

### 5. Deploy

```bash
wrangler deploy
```

That's it. Test with:

```bash
curl -I https://old.example.com/some/path
```

You should get a `301` response pointing to `https://www.example.com/some/path`.


## redirects.txt reference

### Syntax

```
<source-hostname> --> <target-hostname>
```

- One redirect per line
- Raw hostnames only — no `https://`, no paths, no trailing slashes
- Both sides must be valid fully-qualified hostnames (must contain at least one dot)
- Hostnames are lowercased automatically

### Comments

```
// Single-line comment

/*
  Multi-line
  block comment
*/
```

### Validation rules

| Condition | Result |
|-----------|--------|
| Line is not `source --> target` | Deploy fails with a parse error |
| Hostname contains a protocol or path | Deploy fails |
| Duplicate source hostname | Deploy fails |
| Blank line or comment | Silently skipped |

Errors are caught at Worker startup — a bad `redirects.txt` fails the deploy before it ever goes live.

## Route configuration

`redirects.txt` and `wrangler.toml` must stay in sync. Every source hostname needs:

1. A line in `redirects.txt`
2. A matching route in `wrangler.toml`
3. A proxied A record in Cloudflare DNS

When you add a new redirect, add all three. When you remove one, remove all three.

**Why not a wildcard?** A wildcard route (`*.example.com/*`) intercepts every subdomain on
the zone. Anything not in `redirects.txt` returns a 404 — including subdomains you have
running other services on. Use explicit routes.

## How it works

### Request lifecycle

```
Incoming request
  └── index.js        Worker entrypoint, exports fetch handler
       └── router.js  Extracts hostname, looks up REDIRECTS map
            ├── Match found   →  301 redirect, path + query preserved
            └── No match      →  404.html, status 404
```

### Startup

When the isolate initializes, `router.js` runs its top-level module code:

```js
const REDIRECTS = parseRedirects(rawRedirects);
```

`redirects.txt` is bundled as a text module by Wrangler at build time. `parseRedirects`
runs once and the result is cached for every subsequent request — no file I/O at request time.


## Local development

```bash
wrangler dev
```

Test redirects with a custom `Host` header:

```bash
curl -H "Host: old.example.com" http://localhost:8787/some/path
```

## Troubleshooting

**Deploy fails with a parse error**
Check `redirects.txt` for lines that include `https://`, a trailing path, or a missing `-->`.

**A subdomain is returning 404 after deploy**
That subdomain is probably being intercepted by a route in `wrangler.toml` but has no
matching entry in `redirects.txt`. Either add the redirect or remove the route.

**Services on other subdomains went down after deploy**
You likely deployed with a wildcard route. Replace `*.example.com/*` with explicit routes
— one per redirect source. See [Route configuration](#route-configuration).

**Wrangler can't find the text modules**
Add this to `wrangler.toml`:

```toml
[[rules]]
type = "Text"
globs = ["**/*.txt", "**/*.html"]
```

## Contributing

Issues and pull requests are welcome. Please open an issue before submitting a large change.

## License

MIT
