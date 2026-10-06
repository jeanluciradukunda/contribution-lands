# Chrome Web Store listing: paste-ready

New versions upload themselves through the Release workflow (see CONTRIBUTING.md). For a manual upload, use `contribution-lands-<version>.zip` from the GitHub release.

## Store listing tab

**Summary** (comes from the manifest): Turns the contribution graph on GitHub profile pages into an isometric New York skyline, with streaks, stats and landmarks.

**Description:**

Contribution Lands rebuilds the contribution calendar on GitHub profile pages as a small isometric New York. Quiet days stay as empty lots and busy days become taller buildings. Your strongest days are marked with landmark towers, and today's square shows a building under construction.

Above the land, a stats panel shows your total, best day, daily average, and longest and current streaks. Streaks are drawn as a railway along the front street.

How to use: install the extension and open any GitHub profile page. Click the toolbar icon to switch between the flat graph, the land or both, and to turn the stats panel and street traffic on or off. The flat view keeps GitHub's accessible graph.

Privacy: it runs only on github.com and reads the contribution calendar in your browser. It sends nothing to any other server, has no analytics and stores only your display settings.

Open source under the MIT licence. Inspired by Jason Long's Isometric Contributions. Not affiliated with or endorsed by GitHub, Inc.

**Category:** Developer Tools
**Language:** English (UK)
**Store icon:** `store-icon-128.png`
**Screenshots (1280x800):** `screenshot-1-light.png`, `screenshot-2-dark.png`, `screenshot-3-landmark.png`, `screenshot-4-railway.png`
**Small promo tile (440x280):** `promo-small-440x280.png`
**Homepage URL:** https://jeanluciradukunda.github.io/contribution-lands/
**Support URL:** https://github.com/jeanluciradukunda/contribution-lands/issues

## Privacy tab

**Single purpose:** Displays the contribution calendar on GitHub profile pages as an isometric illustrated city, with contribution and streak statistics.

**Permission justification, storage:** Saves display choices: the selected world in chrome.storage.sync, and the view mode, stats panel and motion toggles in chrome.storage.local. No browsing data is stored.

**Host permission justification (https://github.com/\*):** The content script runs on github.com to find the contribution calendar on profile pages and redraw it. To complete streaks and the yearly total it requests the public contributions page github.com/users/<name>/contributions for earlier dates. No other host is contacted.

**Remote code:** No, I am not using remote code. All code is packaged; fetched GitHub pages are parsed as data only.

**Data usage:** tick "Website content" only. Tick all three certifications (not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending).

**Privacy policy URL:** https://jeanluciradukunda.github.io/contribution-lands/privacy.html

## Distribution tab

**Visibility:** Unlisted for the first release, then Public.
