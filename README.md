# Router

Cloudflare Worker for hostname-based redirects with a plain-text config file.

Router keeps redirects simple:

- define rules in `redirects.txt`
- deploy to Cloudflare Workers
- redirect at the edge with no origin server

It currently powers the live `inds.space` setup, and this public repo is the reusable version of that pattern.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Redirect Configuration](#redirect-configuration)
- [Cloudflare Configuration](#cloudflare-configuration)
- [Quick Start](#quick-start)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Production Example](#production-example)
- [License](#license)

## Overview

Router maps one hostname to another destination and responds directly from the Cloudflare edge.

Two target formats are supported:

```txt
source.example.com --> target.example.com
source.example.com --> https://full.url/path
```

Behavior:

- Hostname target: redirects to `https://<target>` and preserves the original path and query string
- Full URL target: redirects to the exact target URL and appends the original query string if present
- Unmatched hostnames return the bundled `404.html` page

At startup, the Worker parses `redirects.txt` once and keeps the redirect map in memory for request-time lookups.

## Features

- Plain-text redirect config in `redirects.txt`
- Startup-time validation for malformed rules and duplicates
- `308` redirects from the edge
- Path and query preservation for hostname redirects
- Support for external full-URL destinations
- Custom `404.html` fallback
- No runtime dependencies

## How It Works

Request lifecycle:

1. `index.js` receives the request and forwards it to `handleRequest`
2. `router.js` extracts the request hostname
3. The hostname is matched against the parsed redirect map
4. If matched, Router returns a `308` redirect
5. If not matched, Router returns `404.html` with status `404`

Startup lifecycle:

1. Wrangler bundles `redirects.txt` and `404.html` as text modules
2. `router.js` imports the raw redirect file
3. `parser.js` validates and parses all entries
4. The parsed redirect map is cached for reuse

Validation fails fast on:

- invalid source hostnames
- malformed `source --> target` lines
- duplicate source hostnames
- invalid targets that are neither hostnames nor full URLs

## Project Structure

```txt
/
├── index.js        # Worker entrypoint
├── router.js       # Redirect lookup and response handling
├── parser.js       # redirects.txt parser and validation
├── redirects.txt   # Redirect source of truth
├── 404.html        # Custom not-found page
└── wrangler.toml   # Worker deployment and custom domain config
```

## Redirect Configuration

### Syntax

```txt
source.example.com --> target.example.com
source.example.com --> https://full.url/path
```

Rules:

- one redirect per line
- source must be a hostname
- target can be a hostname or a full URL
- hostnames are normalized to lowercase
- blank lines are ignored

### Comments

`redirects.txt` supports both comment styles:

```txt
// single-line comment

/*
  multi-line block comment
*/
```

### Examples

```txt
example.com --> www.example.com
go.example.com --> https://docs.example.com/start
```

### Redirect Behavior

For hostname targets:

```txt
old.example.com --> www.example.com
```

Request:

```txt
https://old.example.com/blog/post?ref=x
```

Response destination:

```txt
https://www.example.com/blog/post?ref=x
```

For full URL targets:

```txt
go.example.com --> https://docs.example.com/start
```

Request:

```txt
https://go.example.com/anything?ref=x
```

Response destination:

```txt
https://docs.example.com/start?ref=x
```

The original path is not preserved for full URL targets. The original query string is appended if present.

## Cloudflare Configuration

This repo uses Cloudflare custom domains in `wrangler.toml`:

```toml
[[routes]]
pattern = "example.com"
custom_domain = true
```

Each source hostname should have a matching `[[routes]]` entry.

Important notes:

- remove any existing A, AAAA, or CNAME record for a hostname before assigning it as a Worker custom domain
- Cloudflare handles certificate issuance for the custom domains
- certificates may take some time to become active after first setup

Keep these in sync:

1. `redirects.txt`
2. `wrangler.toml`
3. Cloudflare DNS and Worker custom-domain state

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/your-username/router.git
cd router
```

### 2. Add redirect rules

Edit `redirects.txt`:

```txt
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

### 4. Authenticate Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 5. Deploy

```bash
wrangler deploy
```

## Local Development

Run locally:

```bash
wrangler dev
```

Test with a custom host header:

```bash
curl -H "Host: old.example.com" http://localhost:8787/blog/post?ref=x
```

## Deployment

Recommended change flow:

1. edit `redirects.txt`
2. update `wrangler.toml` if source hostnames changed
3. check Cloudflare for conflicting DNS records
4. run `wrangler deploy`
5. test each changed hostname

## Troubleshooting

### Deploy fails with a parser error

Check for:

- missing `-->`
- invalid hostname syntax
- duplicate source hostnames
- malformed full URLs

### Redirect returns 404

Usually one of these is missing:

- the hostname is not present in `redirects.txt`
- the hostname is not configured in `wrangler.toml`
- the custom domain is not fully active in Cloudflare yet

### Redirect target is wrong

Check whether the rule uses:

- a hostname target, which preserves path and query
- a full URL target, which keeps the fixed target path and only appends the query string

## Production Example

The live `inds.space` deployment uses the same codebase pattern represented here.

Example rules currently in use across the public/private setup include:

- `inds.space --> www.inds.space`
- `my.dc.inds.space --> my.discord.inds.space`
- `code.inds.space --> https://vscode.dev/tunnel/hacktheworld/`
- `my.discord.inds.space --> https://discord.com/users/1176951696048541827`

That mix shows both supported routing modes:

- hostname to hostname
- hostname to full URL

## License

MIT
