#!/usr/bin/env node
// App Store research client. Uses only Apple's public, keyless endpoints:
// the iTunes Search/Lookup API, the top-charts RSS feed and the customer
// reviews RSS feed. Node 18+, no dependencies.
//
//   appstore.mjs search <term> [--limit 25]          who ranks for a search term, in order
//   appstore.mjs keywords <t1,t2,...> [--app <id>]   competition per keyword (+ your rank)
//   appstore.mjs lookup <id> [<id>...]               full listing data for known apps
//   appstore.mjs top [--genre 6012] [--chart free|paid|grossing] [--limit 50]
//   appstore.mjs reviews <id> [--max-stars 3] [--pages 10]
//   appstore.mjs shots <id> [--dir shots]            download an app's store screenshots
//
// Every command takes --country (default us) and --out <file.json> to save
// the full result. Tables go to stdout; save with --out to analyse later.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const GENRES = {
  books: 6018, business: 6000, education: 6017, entertainment: 6016, finance: 6015,
  food: 6023, games: 6014, health: 6013, lifestyle: 6012, medical: 6020, music: 6011,
  navigation: 6010, news: 6009, photo: 6008, productivity: 6007, reference: 6006,
  shopping: 6024, social: 6005, sports: 6004, travel: 6003, utilities: 6002, weather: 6001,
};

function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) opt[a.slice(2)] = true;
      else { opt[a.slice(2)] = next; i++; }
    } else pos.push(a);
  }
  return { pos, opt };
}

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { "User-Agent": "barek-skills/1.0" } });
    if (res.ok) return res.json();
    // The feeds rate-limit bursts with 403/429/503; back off and retry.
    if (i >= tries || ![403, 429, 500, 503].includes(res.status)) {
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    await new Promise((r) => setTimeout(r, 1500 * i));
  }
}

const n = (x) => (x == null ? "" : Number(x).toLocaleString("en-US"));
const r1 = (x) => (x == null ? "" : Number(x).toFixed(1));

function table(rows, cols) {
  const widths = cols.map(([h, f]) => Math.min(40, Math.max(h.length, ...rows.map((r) => String(f(r)).length))));
  const line = (vals) => vals.map((v, i) => String(v).slice(0, widths[i]).padEnd(widths[i])).join("  ");
  console.log(line(cols.map(([h]) => h)));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const r of rows) console.log(line(cols.map(([, f]) => f(r))));
}

function slim(a) {
  return {
    id: a.trackId,
    name: a.trackName,
    developer: a.artistName,
    rating: a.averageUserRating,
    ratings: a.userRatingCount,
    price: a.formattedPrice,
    genre: a.primaryGenreName,
    genres: a.genres,
    age: a.trackContentRating,
    version: a.version,
    updated: a.currentVersionReleaseDate,
    released: a.releaseDate,
    languages: a.languageCodesISO2A,
    url: a.trackViewUrl,
    description: a.description,
    releaseNotes: a.releaseNotes,
    screenshots: a.screenshotUrls,
  };
}

const APP_COLS = [
  ["#", (r) => r.rank],
  ["id", (r) => r.id],
  ["name", (r) => r.name],
  ["developer", (r) => r.developer],
  ["stars", (r) => r1(r.rating)],
  ["ratings", (r) => n(r.ratings)],
  ["price", (r) => r.price],
  ["genre", (r) => r.genre],
];

async function search(term, country, limit) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&country=${country}&limit=${limit}`;
  const data = await getJson(url);
  return data.results.map((a, i) => ({ rank: i + 1, ...slim(a) }));
}

async function lookup(ids, country) {
  const data = await getJson(`https://itunes.apple.com/lookup?id=${ids.join(",")}&country=${country}`);
  return data.results.map((a, i) => ({ rank: i + 1, ...slim(a) }));
}

async function reviews(id, country, pages) {
  const seen = new Map();
  for (const sort of ["mostrecent", "mosthelpful"]) {
    for (let p = 1; p <= pages; p++) {
      const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${p}/id=${id}/sortby=${sort}/json`;
      let feed;
      try { feed = (await getJson(url)).feed; } catch { break; }
      const entries = [].concat(feed.entry ?? []).filter((e) => e["im:rating"]);
      if (!entries.length) break;
      for (const e of entries) {
        // Author names are left out on purpose: the analysis needs what people
        // said, not who said it.
        seen.set(e.id.label, {
          id: e.id.label,
          stars: Number(e["im:rating"].label),
          title: e.title.label,
          text: e.content.label,
          version: e["im:version"]?.label,
          date: e.updated?.label?.slice(0, 10),
          helpful: Number(e["im:voteSum"]?.label ?? 0),
        });
      }
    }
  }
  return [...seen.values()];
}

async function save(out, data) {
  if (!out) return;
  await writeFile(out, JSON.stringify(data, null, 2));
  console.error(`saved ${out}`);
}

const usage = () => {
  console.error(
    "usage: appstore.mjs <search|keywords|lookup|top|reviews|shots> ... [--country us] [--out file.json]\n" +
      "Run with no arguments to see this; the header of this file documents each command.",
  );
  process.exit(64);
};

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opt } = parseArgs(rest);
  const country = (opt.country || "us").toLowerCase();

  switch (cmd) {
    case "search": {
      if (!pos.length) usage();
      const rows = await search(pos.join(" "), country, opt.limit || 25);
      table(rows, APP_COLS);
      await save(opt.out, rows);
      break;
    }
    case "keywords": {
      if (!pos.length) usage();
      const terms = pos.join(" ").split(",").map((t) => t.trim()).filter(Boolean);
      const out = [];
      for (const term of terms) {
        const rows = await search(term, country, 50);
        const top10 = rows.slice(0, 10);
        const counts = top10.map((r) => r.ratings || 0).sort((a, b) => a - b);
        const words = term.toLowerCase().split(/\s+/);
        const mine = opt.app ? rows.find((r) => String(r.id) === String(opt.app)) : null;
        out.push({
          term,
          results: rows.length,
          medianTop10Ratings: counts.length ? counts[Math.floor(counts.length / 2)] : 0,
          top10WithTermInName: top10.filter((r) => words.every((w) => r.name.toLowerCase().includes(w))).length,
          leader: top10[0]?.name,
          yourRank: opt.app ? (mine ? mine.rank : ">50") : undefined,
          top10: top10.map(({ rank, id, name, ratings }) => ({ rank, id, name, ratings })),
        });
      }
      const cols = [
        ["term", (r) => r.term],
        ["results", (r) => r.results],
        ["median top-10 ratings", (r) => n(r.medianTop10Ratings)],
        ["top-10 w/ term in name", (r) => r.top10WithTermInName],
        ["#1 today", (r) => r.leader],
      ];
      if (opt.app) cols.push(["your rank", (r) => r.yourRank]);
      table(out, cols);
      console.error(
        "\nRead: a high median means entrenched apps own the term; a low median with few\n" +
          "exact-name matches is an opening. 'results' caps at 50.",
      );
      await save(opt.out, out);
      break;
    }
    case "lookup": {
      if (!pos.length) usage();
      const rows = await lookup(pos, country);
      table(rows, APP_COLS.slice(1).concat([["updated", (r) => r.updated?.slice(0, 10)], ["version", (r) => r.version]]));
      await save(opt.out, rows);
      break;
    }
    case "top": {
      const chart = { free: "topfreeapplications", paid: "toppaidapplications", grossing: "topgrossingapplications" }[opt.chart || "free"];
      if (!chart) usage();
      const genre = GENRES[String(opt.genre).toLowerCase()] ?? opt.genre;
      const limit = opt.limit || 50;
      const url = `https://itunes.apple.com/${country}/rss/${chart}/limit=${limit}${genre ? `/genre=${genre}` : ""}/json`;
      const entries = [].concat((await getJson(url)).feed.entry ?? []);
      const ids = entries.map((e) => e.id.attributes["im:id"]);
      // The chart feed has no ratings; enrich in batches through lookup.
      const details = new Map();
      for (let i = 0; i < ids.length; i += 100) {
        for (const a of await lookup(ids.slice(i, i + 100), country)) details.set(String(a.id), a);
      }
      const rows = ids.map((id, i) => ({ ...(details.get(id) ?? { id }), rank: i + 1 }));
      table(rows, APP_COLS);
      await save(opt.out, rows);
      break;
    }
    case "reviews": {
      if (pos.length !== 1) usage();
      const all = await reviews(pos[0], country, Number(opt.pages || 10));
      const max = opt["max-stars"] ? Number(opt["max-stars"]) : 5;
      const kept = all.filter((r) => r.stars <= max);
      const dist = [1, 2, 3, 4, 5].map((s) => `${s}★ ${all.filter((r) => r.stars === s).length}`).join("  ");
      console.log(`${all.length} unique reviews (${dist}); kept ${kept.length} at ≤${max}★`);
      console.log("Apple's feed exposes at most ~500 per sort order, newest and most helpful.");
      await save(opt.out, kept);
      if (!opt.out) for (const r of kept.slice(0, 20)) console.log(`\n${r.stars}★ ${r.title}\n${r.text}`);
      break;
    }
    case "shots": {
      if (pos.length !== 1) usage();
      const [app] = await lookup(pos, country);
      if (!app) throw new Error(`no app ${pos[0]} in the ${country} store`);
      const dir = opt.dir || join("shots", String(app.id));
      await mkdir(dir, { recursive: true });
      for (const [i, url] of (app.screenshots ?? []).entries()) {
        const res = await fetch(url);
        await writeFile(join(dir, `${String(i + 1).padStart(2, "0")}.${url.split(".").pop()}`), Buffer.from(await res.arrayBuffer()));
      }
      console.log(`${app.name}: ${app.screenshots?.length ?? 0} screenshots in ${dir} (store order)`);
      break;
    }
    default:
      usage();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
