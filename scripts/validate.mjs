// Validates every data file in this repo. Runs on pull requests and before publish.
// Community PRs to these lists are the main way bad data gets in, so keep the
// failures specific enough to act on without opening the file.
import { readFileSync } from "node:fs";

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));

const LISTS = [
  "bad-actors.json",
  "bad-domains.json",
  "good-domains.json",
  "spaminator-domains.json",
  "spaminator-all.json"
];

const ACCOUNT = /^[a-z][a-z0-9.-]{2,15}$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

// A blocklist entry that is itself a public suffix ("web.app", "co.uk", "github.io")
// condemns every site hosted under it, because consumers walk parent domains when
// matching. Only registrable domains belong in these lists.
//
// The three PSL rule types all matter here. "*.ck" makes "foo.ck" a public suffix, and
// "!www.ck" carves "www.ck" back out as registrable, so neither can be flattened into a
// plain suffix without getting the answer wrong in one direction or the other.
const RULES = new Set();
const WILDCARDS = new Set();
const EXCEPTIONS = new Set();

for (const line of readFileSync(new URL("./public-suffix-list.txt", import.meta.url), "utf8").split("\n")) {
  const rule = line.trim();
  if (!rule || rule.startsWith("#")) continue;
  if (rule.startsWith("!")) EXCEPTIONS.add(rule.slice(1));
  else if (rule.startsWith("*.")) WILDCARDS.add(rule.slice(2));
  else RULES.add(rule);
}

// https://publicsuffix.org/list/ "Algorithm"
function publicSuffixOf(domain) {
  const labels = domain.split(".");

  // Exception rules win outright: the suffix is the rule minus its leftmost label.
  for (let i = 0; i < labels.length; i++) {
    if (EXCEPTIONS.has(labels.slice(i).join("."))) return labels.slice(i + 1).join(".");
  }

  // Otherwise the longest matching rule prevails. i ascends, so the longest comes first.
  for (let i = 0; i < labels.length; i++) {
    const candidate = labels.slice(i).join(".");
    if (RULES.has(candidate)) return candidate;
    if (i < labels.length - 1 && WILDCARDS.has(labels.slice(i + 1).join("."))) return candidate;
  }

  // The implicit "*" rule: the rightmost label.
  return labels[labels.length - 1];
}

const isPublicSuffix = (domain) => publicSuffixOf(domain) === domain;

const lists = {};

for (const file of LISTS) {
  let data;
  try {
    data = read(file);
  } catch (e) {
    fail(file, `not valid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(data)) {
    fail(file, "must be an array");
    continue;
  }
  lists[file] = data;

  const seen = new Set();
  for (const entry of data) {
    if (typeof entry !== "string") {
      fail(file, `entry is not a string: ${JSON.stringify(entry)}`);
      continue;
    }
    if (entry !== entry.trim()) fail(file, `entry has surrounding whitespace: ${JSON.stringify(entry)}`);
    if (entry !== entry.toLowerCase()) fail(file, `entry must be lowercase: ${entry}`);
    if (seen.has(entry)) fail(file, `duplicate entry: ${entry}`);
    seen.add(entry);

    // Unicode entries never match a parsed URL hostname, which is always punycode.
    if (file.includes("domains") && !/^[\x00-\x7F]*$/.test(entry)) {
      const puny = entry
        .split(".")
        .map((l) => (/^[\x00-\x7F]*$/.test(l) ? l : new URL(`https://${l}.test`).hostname.split(".")[0]))
        .join(".");
      if (!seen.has(puny) && !data.includes(puny)) {
        fail(file, `homograph domain ${entry} has no punycode twin (add ${puny})`);
      }
    }
  }

  const sorted = [...data].sort();
  if (data.some((v, i) => v !== sorted[i])) fail(file, "entries must be sorted alphabetically");

  const shape = file.includes("domains") ? DOMAIN : ACCOUNT;
  for (const entry of data) {
    if (typeof entry !== "string" || !/^[\x00-\x7F]*$/.test(entry)) continue;
    if (!shape.test(entry)) fail(file, `malformed entry: ${entry}`);
    if (file.includes("domains") && isPublicSuffix(entry)) {
      fail(
        file,
        `${entry} is a public suffix, so listing it blocks every site hosted under it. ` +
          `List the specific abusive hostname instead.`
      );
    }
  }
}

// A domain cannot be both safe and phishing.
if (lists["good-domains.json"]) {
  for (const [file, key] of [["bad-domains.json", "bad"], ["spaminator-domains.json", "spaminator"]]) {
    if (!lists[file]) continue;
    const overlap = lists[file].filter((d) => lists["good-domains.json"].includes(d));
    if (overlap.length) fail(file, `also listed in good-domains.json (${key}): ${overlap.join(", ")}`);
  }
}

// apps.json
let apps;
try {
  apps = read("apps.json");
} catch (e) {
  fail("apps.json", `not valid JSON (${e.message})`);
}

if (apps !== undefined && (typeof apps !== "object" || apps === null || Array.isArray(apps))) {
  fail("apps.json", "must be an object keyed by app identifier");
  apps = undefined;
}

if (apps) {
  const keys = Object.keys(apps);
  if (!keys.length) fail("apps.json", "registry is empty");
  const sorted = [...keys].sort();
  if (keys.some((k, i) => k !== sorted[i])) fail("apps.json", "keys must be sorted alphabetically");

  for (const [id, app] of Object.entries(apps)) {
    if (id !== id.toLowerCase()) fail("apps.json", `${id}: key must be lowercase, it is matched against json_metadata.app`);
    if (typeof app?.name !== "string" || !app.name) fail("apps.json", `${id}: missing "name"`);

    // Common fields first: entries without a url_scheme still have a homepage.
    if (app?.homepage !== undefined && !String(app.homepage).startsWith("https://")) {
      fail("apps.json", `${id}: homepage must be https`);
    }

    // url_scheme is optional: publishing tools with no web home of their own omit it.
    if (app?.url_scheme === undefined) continue;

    const scheme = app.url_scheme;
    if (typeof scheme !== "string") {
      fail("apps.json", `${id}: url_scheme must be a string`);
      continue;
    }
    if (!scheme.startsWith("https://")) fail("apps.json", `${id}: url_scheme must be https`);
    if (!scheme.includes("{permlink}")) fail("apps.json", `${id}: url_scheme must contain {permlink}`);
    if (scheme.includes("#")) fail("apps.json", `${id}: url_scheme must not use a hash fragment, it is not indexable as a canonical URL`);
    for (const token of scheme.match(/{[^}]*}/g) ?? []) {
      if (!["{category}", "{username}", "{permlink}"].includes(token)) {
        fail("apps.json", `${id}: unknown placeholder ${token}`);
      }
    }
  }
}

if (errors.length) {
  console.error(`${errors.length} problem(s) found:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`OK: apps.json (${Object.keys(apps).length} apps) + ${LISTS.length} lists validated.`);
