function appendSearch(target, search) {
  if (!search) return target;

  const url = new URL(target);
  const incoming = new URLSearchParams(search);
  for (const [key, value] of incoming) {
    url.searchParams.append(key, value);
  }
  return url.toString();
}

function appendWildcardSuffix(target, suffix, targetHasWildcard) {
  const url = new URL(target);
  if (targetHasWildcard) {
    url.pathname = `${url.pathname.slice(0, -1)}${suffix}`;
  } else {
    const basePath = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    url.pathname = `${basePath}${suffix}`;
  }
  return url.toString();
}

export function findRedirect(redirects, url) {
  const hostname = url.hostname.toLowerCase();
  const pathBucket = redirects.paths[hostname];

  if (pathBucket) {
    const exact = pathBucket.exact[url.pathname];
    if (exact) return { entry: exact, suffix: "" };

    for (const wildcard of pathBucket.wildcards) {
      if (url.pathname.startsWith(wildcard.sourcePrefix)) {
        return {
          entry: wildcard,
          suffix: url.pathname.slice(wildcard.sourcePrefix.length),
        };
      }
    }
  }

  const hostnameEntry = redirects.hostnames[hostname];
  return hostnameEntry ? { entry: hostnameEntry, suffix: "" } : null;
}

export function buildDestination(entry, url, suffix = "") {
  if (entry.type === "hostname") {
    return `http://${entry.target}${url.pathname}${url.search}`;
  }

  const target = entry.wildcard
    ? appendWildcardSuffix(entry.target, suffix, entry.targetHasWildcard)
    : entry.target;

  return appendSearch(target, url.search);
}

export function resolveRedirect(redirects, requestUrl) {
  const url = new URL(requestUrl);
  const match = findRedirect(redirects, url);
  if (!match) return null;

  return buildDestination(match.entry, url, match.suffix);
}
