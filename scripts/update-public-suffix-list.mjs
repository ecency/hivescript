// Refreshes scripts/public-suffix-list.txt. Run it when the snapshot goes stale.
// Only multi-label rules are kept: a single-label TLD can never be a list entry,
// because every entry has to contain a dot.
import { writeFileSync } from "node:fs";

const res = await fetch("https://publicsuffix.org/list/public_suffix_list.dat");
if (!res.ok) throw new Error(`public suffix list fetch failed: ${res.status}`);

const rules = new Set();
for (const line of (await res.text()).split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("//")) continue;
  const rule = s.replace(/^[!*.]+/, "");
  if (rule.includes(".")) rules.add(rule);
}

writeFileSync(
  new URL("./public-suffix-list.txt", import.meta.url),
  "# Multi-label rules from https://publicsuffix.org/list/public_suffix_list.dat\n" +
    "# Refresh with: node scripts/update-public-suffix-list.mjs\n" +
    [...rules].sort().join("\n") +
    "\n"
);
console.log(`wrote ${rules.size} rules`);
