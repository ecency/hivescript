# Hivescript

An open standard for Hive based apps.

- `Apps` - URL format and canonical linking schemes
- `BadActors` - accounts mischiefs or phishing attempts
- `BadDomains` - phishing domains
- `GoodDomains` - domains known to be safe
- `Spaminator` - larger imported lists maintained by the Spaminator project

# How to use this package

`yarn add @hiveio/hivescript`

## Files

| File | Shape | What it is |
| --- | --- | --- |
| `apps.json` | object | App registry: display name, homepage and canonical `url_scheme` |
| `bad-actors.json` | string[] | Accounts reported for phishing / typosquatting exchange names |
| `bad-domains.json` | string[] | Phishing domains, curated |
| `good-domains.json` | string[] | Domains known to be safe |
| `spaminator-domains.json` | string[] | Domain blocklist imported from Spaminator |
| `spaminator-all.json` | string[] | Full Spaminator account blocklist (~174k entries, 2 MB) |

`spaminator-all.json` is large. Import it only if you actually need it, and never
into a browser bundle.

## Canonical linking

On Hive, content is stored in blockchain and same information is accessible via different
websites and services built on Hive. Canonical linking to origin of post is important for
entire ecosystem to thrive.

Two things about `apps.json` decide the shape of the code below:

- **`url_scheme` is optional.** Some entries are publishing tools with no web home of their
  own (`beempy`, `steempress`). Reading `.url_scheme` off those gives `undefined`, so always
  fall back to your own scheme rather than assuming it is there.
- **Not every scheme uses `{category}`.** A scheme may contain `{category}`, `{username}` and
  `{permlink}` in any combination. Replace whatever is present and leave the rest alone.

```js
import apps from "@hiveio/hivescript/apps.json";

// Your own site's scheme, used whenever the post's app is unknown to us.
const DEFAULT_SCHEME = "https://example.com/{category}/@{username}/{permlink}";

function canonicalLink(entry, defaultScheme = DEFAULT_SCHEME) {
  // json_metadata is an object on bridge.* but a JSON string on condenser_api.*
  let meta = entry.json_metadata;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }

  // `app` is normally "ecency/3.1.4" but some apps write an object instead. Neither form
  // is guaranteed: json_metadata is arbitrary author-supplied JSON, so check the type
  // before calling string methods on it.
  const app = meta?.app;
  const raw = typeof app === "string" ? app : app?.name;
  const identifier = typeof raw === "string" ? raw.split("/")[0].trim().toLowerCase() : undefined;

  // Falls back when the app is unknown OR known but has no url_scheme of its own.
  const scheme = (identifier && apps[identifier]?.url_scheme) || defaultScheme;

  return scheme
    .replace("{category}", entry.category)
    .replace("{username}", entry.author)
    .replace("{permlink}", entry.permlink);
}
```

### Contributing

`node scripts/validate.mjs` checks every data file: shape, sorting, duplicates, casing,
good/bad overlap, public suffixes and `apps.json` placeholders. CI runs it on every pull
request and again before publish. No dependencies to install.

### Adding or changing an app

Open a pull request against `apps.json`. Entries are sorted by key. A `url_scheme` must be
`https`, must contain `{permlink}`, and must resolve to a real post page: no hash fragments
(`#!/...`), because search engines do not treat those as distinct canonical URLs. Entries
whose domain stops resolving, starts redirecting off-site or gets parked are removed, since a
stale entry sends every frontend's canonical links and the SEO authority behind them to
whoever holds the domain now.

## Bad actors

Bad actors, list of account that is mostly created with intention to take advantage of user
mistype. Sometimes simple misspell can direct funds into wrong accounts, this list contain
those reported accounts.

This section could be part of wallet page in your Dapp where user enters account name to
transfer funds to.

Build a `Set` once at module load. The list is over a thousand entries and `Array.includes`
re-scans all of it on every keystroke.

```js
import badActors from "@hiveio/hivescript/bad-actors.json";

const BAD_ACTORS = new Set(badActors);

// Hive account names are lowercase; normalise before comparing.
if (BAD_ACTORS.has(to_account.trim().toLowerCase().replace(/^@/, ""))) {
  console.warn(
    "Use caution sending to this account. Please double check your spelling for possible phishing."
  );
}
```

## Bad domains

Phishing domains, list of phishing domains, we recommend Dapp/frontend developers check
external link clicks and warn users about potential phishing domains.

This section could be part of content rendering or external link clicking event listener in
your web/mobile/desktop apps.

Parse the URL rather than matching it with a regex. `new URL()` lowercases the host and
converts internationalised domains to punycode, which is what the list stores, so homograph
domains such as `șteemit.com` (`xn--teemit-2lc.com`) are caught. Then walk the parent domains,
otherwise `login.phishing-site.tk` slips past an entry for `phishing-site.tk`.

Because consumers walk parent domains, every entry in these lists has to be a registrable
domain. A public suffix such as `web.app`, `github.io` or `co.uk` would condemn every site
hosted under it, so list the specific abusive hostname instead. CI rejects entries that are
public suffixes.

```js
import badDomains from "@hiveio/hivescript/bad-domains.json";

const BAD_DOMAINS = new Set(badDomains);

function isBadDomain(externalLink) {
  let host;
  try {
    // A terminal dot is a valid, fully qualified host: browsers resolve
    // "steemit24.cf." exactly like "steemit24.cf", so strip it before matching.
    host = new URL(externalLink).hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  } catch {
    return false; // not a URL we can judge
  }

  // "a.b.evil.tk" -> checks "a.b.evil.tk", "b.evil.tk", "evil.tk"
  const labels = host.split(".");
  return labels.some((_, i) => BAD_DOMAINS.has(labels.slice(i).join(".")));
}

if (isBadDomain(external_link)) {
  console.warn("Security alert! Site ahead contains malware / Suspected phishing page.");
}
```

`new URL()` needs an absolute URL. If you are checking hrefs straight out of post bodies,
resolve them first: `new URL(href, "https://example.com")`.

# Contributors

[Hive community](https://hive.io)
