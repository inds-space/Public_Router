import test from "node:test";
import assert from "node:assert/strict";

import { parseRedirects } from "../parser.js";
import { resolveRedirect } from "../router.js";

test("hostname redirects preserve path and query with default http", () => {
  const redirects = parseRedirects("old.example.com --> new.example.com");

  assert.equal(
    resolveRedirect(redirects, "https://old.example.com/blog/post?ref=x"),
    "http://new.example.com/blog/post?ref=x",
  );
});

test("exact path redirects only match the exact path", () => {
  const redirects = parseRedirects("go.example.com/example --> target.example.com/start");

  assert.equal(
    resolveRedirect(redirects, "https://go.example.com/example?ref=x"),
    "http://target.example.com/start?ref=x",
  );
  assert.equal(resolveRedirect(redirects, "https://go.example.com/example/child?ref=x"), null);
});

test("path redirects beat hostname redirects", () => {
  const redirects = parseRedirects(`
    go.example.com --> www.example.com
    go.example.com/example --> target.example.com/start
  `);

  assert.equal(
    resolveRedirect(redirects, "https://go.example.com/example?ref=x"),
    "http://target.example.com/start?ref=x",
  );
});

test("wildcard path redirects preserve the matched suffix", () => {
  const redirects = parseRedirects("go.example.com/example/* --> target.example.com/base/*");

  assert.equal(
    resolveRedirect(redirects, "https://go.example.com/example/a/b?ref=x"),
    "http://target.example.com/base/a/b?ref=x",
  );
  assert.equal(resolveRedirect(redirects, "https://go.example.com/example?ref=x"), null);
});

test("incoming queries append to existing target queries", () => {
  const redirects = parseRedirects("go.example.com/example --> target.example.com/start?existing=1");

  assert.equal(
    resolveRedirect(redirects, "https://go.example.com/example?ref=x"),
    "http://target.example.com/start?existing=1&ref=x",
  );
});

test("explicit https targets remain https", () => {
  const redirects = parseRedirects("go.example.com/example --> https://target.example.com/start");

  assert.equal(
    resolveRedirect(redirects, "https://go.example.com/example?ref=x"),
    "https://target.example.com/start?ref=x",
  );
});

test("parser rejects path-only sources", () => {
  assert.throws(
    () => parseRedirects("/example --> target.example.com"),
    /invalid source hostname/,
  );
});

test("parser rejects protocols on sources", () => {
  assert.throws(
    () => parseRedirects("https://go.example.com/example --> target.example.com"),
    /source must not include a protocol/,
  );
});

test("parser rejects malformed wildcards", () => {
  assert.throws(
    () => parseRedirects("go.example.com/*/example --> target.example.com"),
    /wildcard sources must end with "\/\*"/,
  );
});
