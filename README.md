# Router

Fast Cloudflare Worker redirects from one simple text file.

Router keeps your redirect rules in `redirects.txt`, your domain bindings in `wrangler.toml`, and your routing logic in `router.js`. Change the file, deploy once, and ship clean redirects without dashboard drift.

## Why it sells

- One Worker for hostname redirects, exact paths, and wildcard paths
- One plain-text config file for fast edits and easy review
- One deploy command to push changes live
- One code path that stays easy to audit

## How it works

1. `index.js` receives the request.
2. `router.js` parses `redirects.txt`.
3. `router.js` matches hostname and path rules.
4. Matches return a `308` redirect.
5. Misses return `404.html`.

No shared cache, no database, no hidden control panel state.

## Rule format

```txt
source.example.com --> target.example.com
source.example.com/path --> target.example.com/path
source.example.com/path/* --> target.example.com/base/*
```

What you get:

- Hostname redirects keep the incoming path and query string
- Exact-path redirects only match that exact path
- Wildcard redirects keep the matched suffix
- Query strings carry through to the destination

## Project structure

```txt
/
|- index.js
|- router.js
|- parser.js
|- redirects.txt
|- 404.html
`- wrangler.toml
```

## Quick start

```bash
git clone <your-repo-url>
cd router
npm test
wrangler login
wrangler deploy
```

Add your rules to `redirects.txt` and make sure each source domain also exists in `wrangler.toml`.

## Troubleshooting

- Deploy error: check for a bad hostname, bad target, missing ` --> `, or duplicate source.
- Redirect miss: make sure the source rule exists and the domain is bound in `wrangler.toml`.
- Wrong destination: confirm whether the rule is hostname, exact-path, or wildcard.

## License

[MIT](LICENSE)
