# SignalFeed

Live cybersecurity, geopolitics and economy & finance headlines, read directly from each publisher.

- `scripts/fetch-feeds.mjs` reads every source and writes `site/data/headlines.json`.
- `.github/workflows/update-headlines.yml` runs it every 5 minutes and publishes `site/` to GitHub Pages.
- `site/index.html` is the page. It checks for a fresh headlines file every minute. Stories are kept for 3 weeks, then deleted.

## Sources

| Cybersecurity | Geopolitics | Economy & Finance |
|---|---|---|
| The Hacker News, BleepingComputer (feed + home-page backup), Dark Reading, SecurityWeek, Krebs on Security, SANS ISC (no podcast entries), IT-Connect (security stories only) | BBC World, The Guardian, Al Jazeera (news only, no sport or video), Foreign Policy, France 24 | Financial Times and The Economist (headline + summary; articles are paywalled), BBC Business, Guardian Business, CNBC, MarketWatch, DW Business, France 24 Business, ECB, Federal Reserve |

To add or remove a source, edit the `SOURCES` list at the top of `scripts/fetch-feeds.mjs`.

## Settings

- Pages: Settings → Pages → Source: **GitHub Actions**.
- Run by hand: Actions → Update headlines → Run workflow.
- A monthly empty "keepalive" commit stops GitHub from pausing the schedule after 60 days without activity.
