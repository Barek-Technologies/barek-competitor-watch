#!/usr/bin/env node
// First-pass tally of complaint themes across review files saved by
//   appstore.mjs reviews <id> --max-stars 3 --out reviews/<app-name>.json
//
//   themes.mjs reviews/*.json [--themes my-themes.json] [--quotes 3] [--out themes.json]
//
// Prints a theme × app count table (Markdown) and the most helpful matching
// quotes per theme. Keyword matching is a starting point, not the analysis:
// read the unmatched reviews too, add the themes your category has, and
// re-run with --themes. A theme file is { "Theme name": ["regex", ...] }.

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const DEFAULT_THEMES = {
  "Paywall / free tier is a demo": ["paywall", "pay ?wall", "premium", "subscri", "locked", "have to pay", "everything costs", "not free", "free version"],
  "Billing, trial, cancel, refund": ["refund", "charged", "cancel", "free trial", "billing", "auto.?renew", "scam"],
  "Repetitive or shallow content": ["repetitive", "same (questions|thing)", "ran out", "boring", "shallow", "generic", "not enough content"],
  "Crashes, bugs, data loss": ["crash", "bug", "glitch", "freez", "won'?t (open|load)", "lost (all|my)", "data loss", "doesn'?t work"],
  "Sync / partner connection": ["sync", "connect(ing)? (to|with) (my )?partner", "partner can'?t", "link(ing)? (our|accounts)", "pair(ing)?"],
  "Notifications": ["notification", "reminder", "push"],
  "Ads": ["\\bads?\\b", "advert"],
  "Login / account": ["log ?in", "sign ?in", "account", "password", "verification"],
  "Support unresponsive": ["support", "no response", "never (replied|responded)", "contact(ed)? (them|the developer)"],
  "Privacy / data": ["privacy", "data", "track", "sell (my|our)"],
  "Missing feature request": ["wish (it|there|you)", "please add", "would (love|be nice)", "should add", "feature request", "if only"],
};

function parseArgs(argv) {
  const files = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[++i];
    else files.push(argv[i]);
  }
  return { files, opt };
}

async function main() {
  const { files, opt } = parseArgs(process.argv.slice(2));
  if (!files.length) {
    console.error("usage: themes.mjs reviews/*.json [--themes themes.json] [--quotes 3] [--out themes.json]");
    process.exit(64);
  }
  const themes = opt.themes ? JSON.parse(await readFile(opt.themes, "utf8")) : DEFAULT_THEMES;
  const matchers = Object.entries(themes).map(([name, pats]) => [name, new RegExp(pats.join("|"), "i")]);
  const quoteCount = Number(opt.quotes ?? 3);

  const apps = [];
  for (const f of files) {
    apps.push({ app: basename(f, ".json"), reviews: JSON.parse(await readFile(f, "utf8")) });
  }

  const result = { apps: apps.map((a) => ({ app: a.app, reviews: a.reviews.length })), themes: [] };
  const unmatched = {};
  for (const { app, reviews } of apps) {
    unmatched[app] = reviews.filter((r) => !matchers.some(([, re]) => re.test(`${r.title} ${r.text}`))).length;
  }
  for (const [name, re] of matchers) {
    const counts = {};
    const quotes = [];
    for (const { app, reviews } of apps) {
      const hits = reviews.filter((r) => re.test(`${r.title} ${r.text}`));
      counts[app] = hits.length;
      quotes.push(...hits.map((r) => ({ app, stars: r.stars, helpful: r.helpful, title: r.title, text: r.text })));
    }
    quotes.sort((a, b) => b.helpful - a.helpful || a.stars - b.stars);
    result.themes.push({ theme: name, counts, total: Object.values(counts).reduce((a, b) => a + b, 0), quotes: quotes.slice(0, quoteCount) });
  }
  result.themes.sort((a, b) => b.total - a.total);

  const head = apps.map((a) => `${a.app} (${a.reviews.length})`);
  console.log(`| Theme | ${head.join(" | ")} |`);
  console.log(`|---|${head.map(() => "---").join("|")}|`);
  for (const t of result.themes) console.log(`| ${t.theme} | ${apps.map((a) => t.counts[a.app]).join(" | ")} |`);
  console.log(`| *(no theme matched)* | ${apps.map((a) => unmatched[a.app]).join(" | ")} |`);
  console.log("\nA review can hit several themes. Read the unmatched ones before trusting the table.");

  for (const t of result.themes.filter((t) => t.total)) {
    console.log(`\n### ${t.theme}`);
    for (const q of t.quotes) {
      const text = q.text.replace(/\s+/g, " ").slice(0, 280);
      console.log(`- **${q.app}, ${q.stars}★:** "${text}${q.text.length > 280 ? "…" : ""}"`);
    }
  }

  if (opt.out) {
    await writeFile(opt.out, JSON.stringify(result, null, 2));
    console.error(`\nsaved ${opt.out}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
