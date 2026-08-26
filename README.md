# Taiyabah Masjid — Home Smart Screen

Repo: `Taiyabah-Masjid-HomeSmartScreen`
Live: https://yameenbux.github.io/Taiyabah-Masjid-HomeSmartScreen/

A single-page prayer-times dashboard for people's own tablets and TVs at home. Part of a larger
"Taiyabah Masjid — Complete Overhaul" that also includes a website rebrand, a mobile app, and in-mosque
TV signage — three sibling repos under the same GitHub account. This repo reuses their branding, fonts,
and data rather than inventing anything new.

## What this app does

Live clock, Gregorian + Hijri date, a countdown to the next Jamā'ah, today's full Begins/Jamā'ah table with
the current prayer highlighted, a standing next-Jumu'ah banner, full-screen Ramadan/Eid greetings, three
footer buttons (month browser, New Build appeal with real bank details, contact), and **automatic Adhan and
Iqamah audio** — a full Adhan 15 minutes before each Jamā'ah, a short Iqamah at Jamā'ah time itself, sourced
to sound like Makkah's Grand Mosque.

It's designed as an always-on ambient display (a tablet propped on a shelf, a TV left on) — most of the
harder engineering in here is about keeping the audio triggers reliable on a device that isn't being
actively touched most of the time.

## Architecture — read this before editing anything

**`template.html` is the source of truth. `index.html` is generated output — never hand-edit it
directly**, edits will be lost the next time the build script runs. The build (`build.py`) is a simple
Python placeholder-substitution, not a bundler:

```python
out = open('template.html').read()
for placeholder, path in SOURCES.items():                    # three JSON blobs
    blob = json.loads(open(path).read())
    out = out.replace(placeholder, json.dumps(blob, separators=(',',':'), ensure_ascii=False))
for placeholder in SOURCES:
    assert placeholder not in out   # catch a bad substitution before shipping it
open('index.html', 'w').write(out)
```

```bash
python3 build.py     # after ANY edit to template.html or data/*.json
```

`__TIMETABLE_JSON__` comes from `data/timetable-2026.json`. `__NEWBUILD_JSON__` and `__OCCASIONS_JSON__`
are small JSON blobs (appeal/bank details, Ramadan/Eid date rules) in `data/newbuild.json` and
`data/occasions.json`, originally pulled from the sibling `Taiyabah-Mosque-Interactive-Screens` repo's
`foyer-content.json` — if that repo's content changes, this one needs a manual re-sync, there's no
automatic link between them.

Everything else — CSS, JS, markup — lives entirely inside `template.html` as one self-contained file. No
build tooling beyond stdlib Python, no npm dependencies for the app itself (Playwright is only used for
testing, see below).

**Why the built page sits at the repo root and not in a `dist/` folder:** GitHub Pages "deploy from a
branch" can only serve `/` or `/docs` — never `/dist`. Building into `dist/` would mean either a custom
Actions deploy workflow or a broken live site, so the build writes `index.html` in place instead. If that
ever changes, move the deploy first and the layout second.

### Repo layout

```
template.html              ← EDIT THIS
build.py                   ← template.html + data/*.json → index.html
index.html                 ← generated, do not hand-edit; this is what Pages serves
manifest.webmanifest       ← PWA manifest (has an "id" field — don't remove it, PWABuilder flags its absence)
sw.js                      ← service worker: network-first for index.html, cache-first for audio/icons
data/
  timetable-2026.json      ← prayer times, see schema below
  newbuild.json            ← New Build appeal copy + bank details
  occasions.json           ← Ramadan/Eid greeting text + duration rules
audio/
  adhan-full.mp3           ← real ~3.4min recording, github.com/abodehq/Athan-MP3, no formal licence file
  iqamah-short-PLACEHOLDER.mp3  ← REAL ~51s recording despite the filename — cosmetic rename still pending
logo-cream.png, logo-dark.png, icon-192.png, icon-512.png, apple-touch-icon.png
test-scripts/              ← Playwright tests, see Testing section below
```

### Data model

```
timetable["days"]["YYYY-MM-DD"] = {
  hijri: {...},
  begins:  { fajr, sunrise, zuhr, asr, maghrib, isha },   // used to highlight the "current" prayer row
  jamaat:  { fajr, zuhr, asr, maghrib, isha },            // used for the countdown + audio triggers
  jummah?: { first, second }                               // present on Fridays only; Zuhr's jamaat slot
                                                            // is NOT used on Fridays — jummah.first replaces it
}
```

**The dataset only covers 2026.** It will need a fresh file (or an extended one) before the year turns over,
or the app will silently have nothing to show. There is no fallback/error state for a missing date — worth
adding if this isn't refreshed in time.

## Things that look like bugs but are deliberate

- **3-minute audio catch-up window** (`CATCHUP_WINDOW_MS` in the JS): if the tab/PWA was backgrounded exactly
  when a trigger should have fired (iOS aggressively suspends JS timers), it retries `play()` for up to 3
  minutes after the fact rather than silently missing it forever. There's also a `visibilitychange`/`focus`
  listener that re-checks immediately on resume instead of waiting for the next 1-second tick.
- **The sound-enable pill never disappears.** It shows amber "Enable Adhan & Iqamah sound" or green "Sound on
  · tap to test" permanently, and tapping it when already unlocked plays an audible confirmation chime. An
  earlier version hid the pill once tapped with no feedback — that was the direct cause of a real missed Adhan
  in testing, don't reintroduce that pattern.
- **Screen Wake Lock is requested on load and every `visibilitychange` back to visible.** It is NOT supported
  on iOS Safari — there's no workaround for that in-browser; the device's own Settings → Display → Auto-Lock
  has to be set to Never for iOS to behave like an always-on kiosk.
- **GitHub Pages serves via a case-sensitive filesystem.** A prior deploy broke because folders were named
  `Audio`/`Data` while the code references lowercase `audio`/`data`. If something 404s after a file move/rename
  via GitHub's web editor, check the actual resulting path (a web-editor rename previously left a stray
  `Audio` prefix stuck onto a filename instead of cleanly replacing it) — don't assume the rename did what it
  looked like it did.

## D-pad / remote-control navigation

Added specifically ahead of Android TV packaging — every interactive element is a real `<button>`, so
Tab/Enter/D-pad navigation works structurally, but on top of that:

- Every focusable element gets a visible gold focus ring (`:focus-visible` with a `:focus` fallback for
  older TV WebViews that don't support `:focus-visible`). The fallback direction matters: the plain
  `:focus` rule comes first and a `:focus:not(:focus-visible)` rule withdraws it for pointer focus, so a
  WebView that can't parse `:focus-visible` discards the withdrawal and keeps the ring.
- `openModal(wrapId, triggerEl)` / `closeModal(wrapId)` (search for these in the JS) handle all three modals
  identically: focus moves inside on open, Tab wraps within the modal instead of escaping it, Escape closes
  and restores focus to whichever button opened it. Escape/Tab are handled at document level rather than per
  modal, so a modal is still closeable if focus has somehow ended up outside it — on a kiosk there's nobody
  around to click the page and un-wedge it.
- The Ramadan/Eid occasion overlay is a `<div role="button" tabindex="0">` with an explicit Enter/Space
  keydown handler (divs don't get free keyboard activation the way real buttons do), and takes focus when it
  first appears, since it covers everything else on screen. It is the one deliberate exception to the focus
  ring: a ring says *which* of several targets is active, and this is one target filling the whole screen,
  so all a ring does is put a gold border around an Eid greeting. `.occasion:focus` is explicitly
  `outline:none` — the "tap anywhere — or press OK" line is the affordance. Don't "fix" it back.
- On load, `focusAmbient(true)` puts focus on the sound pill (if it needs attention) or the first footer
  button — otherwise a remote's first "OK" press would do nothing, since nothing is focused by default
  without a prior pointer interaction. It's marked with a temporary `.initfocus` class because Chrome won't
  match `:focus-visible` for focus placed programmatically before any key press, and an invisible starting
  position is the exact thing this is meant to fix. The class is dropped on first blur or pointer-down.

If you add new interactive elements, wire them into this pattern rather than inventing a new one.

## Android TV packaging — in progress, use PWABuilder, not a local Android build

The plan is a Trusted Web Activity (Chrome wrapper) via **pwabuilder.com**, not a native rewrite. Do not
attempt a local Gradle/Bubblewrap build unless you have confirmed working network access to
`dl.google.com`, `repo.maven.apache.org`, and `services.gradle.org` — a prior attempt from a sandboxed
environment hit a hard network wall there.

Two things to know before touching this:

1. **Digital Asset Links are checked per-origin, not per-path.** Because the site lives at
   `yameenbux.github.io/Taiyabah-Masjid-HomeSmartScreen/`, `.well-known/assetlinks.json` has to be reachable
   at the *root* of `yameenbux.github.io` — a separate `yameenbux.github.io`-named repo, not this one.
   Without it the packaged app still installs and works, it just shows Chrome's address bar instead of
   looking fully native. **Recommended real fix: move this dashboard to a subdomain of taiyabahmasjid.com**
   (e.g. `home.taiyabahmasjid.com`) so `.well-known/` is fully controllable at that domain's root.
2. **PWABuilder's Android output is a precompiled, already-signed APK, not an editable source project.**
   Adding the Android TV leanback banner + `LEANBACK_LAUNCHER` intent-filter requires opening the generated
   project in Android Studio and rebuilding/re-signing with the same keystore — it's not a drop-a-PNG-in
   edit. Treat that as a distinct follow-up task, not part of the initial build.

A `twa-manifest.json`, an `assetlinks.json` template (package `com.taiyabahmasjid.homescreen`), and three
Android TV banner images (320×180 / 480×270 / 640×360, built from the real logo on the brand gradient) were
prepared separately and handed to Yameen — ask him for `android-package.zip` if you need them rather than
regenerating from scratch.

**Amazon Fire TV is untested and likely doesn't work.** Fire OS doesn't ship Chrome or Google Play Services
by default, and a Trusted Web Activity needs Chrome (or another Custom-Tabs-capable browser) present on the
device to render at all. Don't promise Fire TV compatibility without actually testing on a Fire TV device.

Amazon Alexa Show is a separate, unstarted problem — it needs an APL skill, this HTML can't be embedded
directly there.

## Testing

There's no CI. Testing during development used Playwright scripts, checked into **`test-scripts/`** at the
repo root — run the relevant one after any change to `template.html` (and after `python3 build.py`, since
the scripts drive the built `index.html`, not the template), especially anything touching the countdown,
audio triggers, occasion banners, or keyboard/D-pad navigation. See `test-scripts/README.md` for full
details on each script and setup (`npm install` + `npx playwright install chromium`), but in short:

- `screenshot.js` / `screenshot-dates.js` — visual regression across viewport sizes and specific
  dates/states (Friday, Ramadan, Eid, support modal).
- `test-audio.js` / `test-catchup.js` — verify Adhan/Iqamah actually fire at the right moment, including the
  3-minute catch-up window. Run these after touching `CATCHUP_WINDOW_MS` or the trigger-retry logic.
- `test-dpad.js` — drives the page with real Tab/Enter/Escape key presses to verify focus rings, modal focus
  trapping (both directions), focus restore-on-close, and backdrop click-to-close. Run after touching modal
  markup or the `openModal`/`closeModal` helpers.
- `audit.js` — the broadest check, deliberately run against a fresh clone of the **live deployed site**
  (into a `test-scripts/live-check/` folder), not the local build. Run this after every push to `main`.

Several of these need a fake `Date` where time still *advances* during `page.waitForTimeout()` — a frozen
fixed timestamp breaks this (nothing ever fires). The working pattern is an offset applied to the real clock:

```js
const RealDate = Date;
const target = new RealDate(isoString).getTime();
const offset = target - RealDate.now();
class FakeDate extends RealDate {
  constructor(...args){ if(args.length===0){ super(RealDate.now()+offset); } else { super(...args); } }
  static now(){ return RealDate.now()+offset; }
}
Date = FakeDate;
```
Using a frozen fixed timestamp instead of an offset means time never advances during a `waitForTimeout()` —
that was a real bug hit once already, don't repeat it. (`screenshot-dates.js` is the one exception that
deliberately uses a frozen timestamp — it only needs a single consistent snapshot in time, not a running
clock.)

## Git / deploy

This is a live production site on GitHub Pages — commits to `main` go live automatically. There is no
staging environment. Run `python3 build.py` and verify `index.html` locally (open it directly, or serve it)
before committing. Audio and JSON changes are especially easy to get wrong silently (a bad JSON
substitution still produces a page that loads, just with broken data) — the assert-no-placeholders-remain
check in the build step is there for exactly that reason, don't remove it.

## Known open items

1. Rename `audio/iqamah-short-PLACEHOLDER.mp3` → something clean now that it holds the real recording
   (three references to update: `template.html`, `sw.js`'s `SHELL` list, and the rebuilt `index.html`).
2. `data/timetable-2026.json` needs a 2027 follow-up (or a multi-year file) before the year turns over.
3. Custom domain (`home.taiyabahmasjid.com` or similar) — fixes the assetlinks.json root-domain problem
   properly and gives a nicer URL.
4. Finish the Android TV package via PWABuilder (see above), then the leanback banner/intent-filter as a
   follow-up.
5. Amazon Alexa Show and confirmed Fire TV support — both fully unstarted.

## Credits

Built for Bolton Central Islamic Society. Prayer times, the Taiyabah Masjid name, and the masjid's logo
belong to the charity. Adhan recording credited to the abodehq/Athan-MP3 collection — that repo carries no
formal licence file, only a note that the collection is free to download, so treat the provenance as
unverified rather than cleared for commercial use. Fine for a community masjid's own non-commercial home
screen; worth knowing if this is ever redistributed more widely.
