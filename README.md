# Barek Competitor Watch

An agent skill for [Claude Code](https://claude.com/claude-code) (and any agent
that reads `SKILL.md` skills) that studies the apps you compete with on the App
Store, reads their low-star reviews to find what customers are asking for, and
turns it into a ranked backlog for your app.

Your competitors' 1–3★ reviews are a free list of what your category's
customers want and aren't getting. This skill turns them into decisions:
what to build, what to fix, what to promise on your store page, and what not
to copy.

## What it does

1. **Reads your app first:** core loop, pricing, free tier, category.
2. **Picks the competitor set:** from search results and the category chart, or the apps you name.
3. **Captures their listings:** ratings, price ladder, age rating, update cadence, languages.
4. **Pulls their reviews:** up to ~1,000 per app from Apple's public feed, keeping the 1–3★ ones.
5. **Tallies complaint themes per app:** paywall, billing, crashes, sync, missing features. Then the agent reads every review to refine the themes.
6. **Writes a dated report:** at-a-glance table, each app briefly, patterns, a theme × app count table with verbatim quotes, "our edge" promises and a ranked backlog.
7. **Watches:** re-run monthly and get a "changes since last time" section.

Just ask: *"Do a competitor study for my app"*, *"What do people hate about
the top apps in my category?"*, or run `/barek-competitor-watch`.

## Install

With npm (Node 18+), from your project folder:

```bash
npx barek-competitor-watch             # this project: ./.claude/skills/
npx barek-competitor-watch --global    # every project: ~/.claude/skills/
npx barek-competitor-watch --dir .agents/skills   # any other agent's skills folder
```

Run the same command again to update.

Or with the [skills CLI](https://www.npmjs.com/package/skills), or plain git:

```bash
npx skills add Barek-Technologies/barek-competitor-watch
git clone https://github.com/Barek-Technologies/barek-competitor-watch ~/.claude/skills/barek-competitor-watch
```

## The scripts

Node 18+, no dependencies, no API keys. They use Apple's public iTunes
Search/Lookup API and RSS feeds.

```bash
scripts/appstore.mjs search "couples app" --limit 25        # who ranks for a term
scripts/appstore.mjs top --genre lifestyle --limit 100      # category chart (free|paid|grossing)
scripts/appstore.mjs lookup 1469609343 409609608 --out listings.json
scripts/appstore.mjs reviews 1469609343 --max-stars 3 --out reviews/paired.json
scripts/themes.mjs reviews/*.json --quotes 3                # theme × app table + top quotes
```

Every command takes `--country` (default `us`). `themes.mjs` takes
`--themes my-themes.json` (`{ "Theme": ["regex", ...] }`) to use your own
category's themes.

Example `themes.mjs` output for two apps:

```
| Theme                          | couple-joy (48) | cozy-couples (117) |
|--------------------------------|-----------------|--------------------|
| Paywall / free tier is a demo  | 25              | 63                 |
| Repetitive or shallow content  | 1               | 18                 |
| Missing feature request        | 4               | 15                 |
```

## Limits

- Apple's review feed exposes about 500 reviews per sort order per storefront. That's plenty for patterns, but it isn't every review ever written.
- Google Play has no public review API. The skill reads Play reviews in a browser when you need them, and doesn't scrape.
- The keyword tally is a starting map. The skill tells the agent to read the reviews themselves, and the report only counts a theme a reader would agree with.
- Reviewer names are never saved or quoted.

## More Barek skills

| Skill | What it does |
| --- | --- |
| [barek-competitor-watch](https://github.com/Barek-Technologies/barek-competitor-watch) | Competitor study and review mining → what to build next |
| [barek-aso](https://github.com/Barek-Technologies/barek-aso) | Store name, subtitle, keywords and descriptions, researched against what ranks |
| [appstore-screenshots](https://github.com/Barek-Technologies/appstore-screenshots) | Highest-converting screens, captioned and rendered at exact store sizes |

They share one research client (`scripts/appstore.mjs`) and hand off to each
other: the competitor study feeds the copy and the screenshot story.

## License

MIT © 2026 Barek Technologies Limited. See [LICENSE](LICENSE).
