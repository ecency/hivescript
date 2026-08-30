// Refreshes scripts/public-suffix-list.txt from publicsuffix.org.
//
// Rules are written verbatim, keeping the "*." wildcard and "!" exception prefixes,
// because the matching algorithm in validate.mjs needs all three rule types. Flattening
// them is wrong in both directions: dropping "*.ck" loses the public suffix "foo.ck",
// and turning "!www.ck" into "www.ck" marks a registrable domain as a suffix.
//
// Unicode rules are converted to punycode, which is the form the data files store and
// the form new URL().hostname produces.
import { writeFileSync } from "node:fs";

const res = await fetch("https://publicsuffix.org/list/public_suffix_list.dat");
if (!res.ok) throw new Error(`public suffix list fetch failed: ${res.status}`);

const toPunycode = (domain) => new URL(`https://${domain}`).hostname;

const lines = (await res.text()).split("\n");

// The list is MPL 2.0 and this repository is MIT, so the upstream notice travels with the
// snapshot. Taken from the file rather than hardcoded, so a reworded notice still lands.
const notice = [];
for (const line of lines) {
  if (!line.trim()) {
    if (notice.length) break;
    continue;
  }
  if (!line.startsWith("//")) break;
  notice.push(`#${line.slice(2)}`);
}
if (!notice.join(" ").includes("Mozilla Public")) {
  throw new Error("upstream licence notice not found, refusing to write");
}

const rules = new Set();
for (const line of lines) {
  const s = line.trim();
  if (!s || s.startsWith("//")) continue;

  const prefix = s.startsWith("!") ? "!" : s.startsWith("*.") ? "*." : "";
  const domain = s.slice(prefix.length);
  rules.add(prefix + (/^[\x00-\x7F]*$/.test(domain) ? domain : toPunycode(domain)));
}

if (rules.size < 5000) throw new Error(`only ${rules.size} rules parsed, refusing to write`);

writeFileSync(
  new URL("./public-suffix-list.txt", import.meta.url),
  [
    ...notice,
    "#",
    "# Generated from https://publicsuffix.org/list/public_suffix_list.dat, punycode normalised.",
    "# Licensed under MPL 2.0: https://mozilla.org/MPL/2.0/. Not part of the npm package.",
    "# Rule types are significant: '*.' is a wildcard, '!' is an exception.",
    "# Refresh with: node scripts/update-public-suffix-list.mjs",
  ].join("\n") +
    "\n" +
    [...rules].sort().join("\n") +
    "\n"
);
console.log(`wrote ${rules.size} rules`);
