---
name: barek-competitor-watch
description: Study the competing apps in your niche on the App Store, then mine their low-star reviews for what customers are asking for and turn it into an improvement backlog. Use when the user wants a competitor study, competitive analysis, review mining, "what do users hate about X", "what are people asking for", market gaps, or wants to know what to build or fix next based on rival apps. Pulls listings, ratings, prices and reviews from Apple's public endpoints, tallies complaint themes, and writes a dated report ending in promises and a ranked backlog.
---

# Barek Competitor Watch

Your competitors' 1–3★ reviews are a free list of what your category's
customers want and are not getting. This skill turns them into decisions:
what to build, what to fix, what to promise on the store page, and what not to
copy.

The output is one Markdown report (default `docs/COMPETITORS.md`) that a
founder can act on. Every claim in it traces to a listing or a verbatim review.

## Workflow

### 1. Know your own app first

Read the codebase before you look at anyone else: what the app does, its core
loop, its price and free tier (look for paywall, subscription or RevenueCat /
StoreKit / Billing config), its platforms and its store category. You compare
against this, so get it right. Write it down in two or three lines at the top of
the report.

### 2. Pick the competitor set

If the user names apps, use those. Otherwise build the set and show it to the
user before going further:

```bash
scripts/appstore.mjs search "<what your app does, in a user's words>" --limit 25
scripts/appstore.mjs search "<a second phrasing>" --limit 25
scripts/appstore.mjs top --genre lifestyle --limit 100    # the category chart
```

Choose 4–8 apps that a customer would actually pick instead of yours: the
category leader (most ratings), the closest model to yours, one or two fast
risers (recent `updated`, high rating, modest count), and one adjacent app that
solves the same need differently. Note each app's id; everything else keys off
it. Run searches in the country the user cares about (`--country gb`, `ng`,
etc.); rankings and reviews differ per storefront.

### 3. Capture the listings

```bash
scripts/appstore.mjs lookup <id> <id> ... --out research/listings.json
```

For each app record: developer, ratings count and average, age rating, price
and in-app purchase ladder, last update and version cadence, languages,
category, and the core loop in one line. The lookup gives description and
release notes but **not** the subtitle or in-app purchase prices. Get those
from the store page (`https://apps.apple.com/<country>/app/id<id>`) with a web
fetch or the browser. Date the capture: store pages change weekly.

### 4. Pull the reviews

```bash
mkdir -p research/reviews
scripts/appstore.mjs reviews <id> --max-stars 3 --out research/reviews/<short-name>.json
```

Apple's public feed exposes up to ~500 reviews per sort order (newest and most
helpful). The script reads both and de-duplicates. Name each file after the
app; the name becomes the column heading in the theme table. Run it without
`--max-stars` once per app as well if you want the star distribution.

**Read the low-star reviews. All of them, if there are fewer than ~1,000.**
The keyword tally in step 5 is a map, not the territory. The insight is in
the specifics: what exactly broke, which paywall moment made them leave, which
feature they'd pay for.

### 5. Tally the themes

```bash
scripts/themes.mjs research/reviews/*.json --quotes 3 --out research/themes.json
```

This counts complaint themes per app and pulls the most helpful quotes. Then
improve it: read the "(no theme matched)" reviews, add the themes your category
has (write a `{ "Theme": ["regex", ...] }` file and pass `--themes`), merge
themes that are really one, and re-run. A theme only counts if a human reading
the matched reviews agrees they are about that thing.

Separate three kinds of signal:

- **Complaints**: something exists and hurts (paywall, crashes, billing).
- **Requests**: something is missing ("I wish", "please add", "would pay for").
- **Praise in low-star reviews**: "I love X but…" tells you what to keep.

### 6. Write the report

Use this structure. It is the shape that has worked in practice:

1. **Header**: date studied, storefront, the competitor set and why each is in it, your app in two lines.
2. **At a glance**: one table, one row per app: developer, ratings · stars, age rating, core loop, price ladder.
3. **Each one, briefly**: one paragraph per app: positioning, what users love, what they complain about, recent moves (redesigns, new pricing).
4. **Patterns across the set**: pricing norms, monetisation tricks (streak repair, packs, lifetime), onboarding, what every one of them does and what none of them do.
5. **What their users complain about**: method line (how many reviews, how many low-star, date), the theme × app count table, then per app the top themes with 2–4 **verbatim** quotes each.
6. **Our edge**: numbered promises the complaints write for you ("Free means usable: never lock the core loop"). Each promise names the theme it answers and the evidence count.
7. **Backlog**: ranked improvements. For each: the problem (with the theme count), the change, effort (S/M/L), and whether it is a fix, a feature or a store-page claim. Put cheap, high-count items first.

Then summarise the top three moves for the user in chat. Do not paste the whole report.

### 7. Re-run it (the "watch" part)

Competitors ship weekly. Keep `research/` and re-run steps 3–5 on a schedule
(monthly is plenty) and add a dated "Changes since <last date>" section at the
top: new versions, rating moves, price changes, new complaint themes, themes
that went quiet because they fixed them.

## Rules

- **Verbatim or nothing.** Quote reviews exactly; never paraphrase a quote, never invent one. Leave reviewer names out of the report.
- **Counts are counts.** Say "172 of 351 low-star Paired reviews mention the paywall", not "most users hate the paywall".
- **Date every number.** Ratings, prices and ranks are a snapshot.
- **Don't copy their mistakes.** A pattern that every rival has and every reviewer hates is a gap, not a norm.
- **Their trademarks stay theirs.** The study is internal. Never put a competitor's name in your own store listing, keywords or screenshots.
- **Play Store:** there is no public review API. If the user needs Android reviews, read them on the Play page in a browser, or ask before adding a scraping dependency.

## Pairs well with

- `barek-aso`: turns the edge and the vocabulary customers use in reviews into store copy and keywords.
- `appstore-screenshots`: turns the edge into the screenshot story.
