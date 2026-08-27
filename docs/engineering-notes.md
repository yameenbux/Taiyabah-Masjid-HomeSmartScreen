# Engineering notes

The detail behind the decisions in this codebase — why things are built the way they are, and which
apparent oddities are load-bearing. If you're about to change something and it looks wrong, the reason is
probably in here.

The [README](../README.md) is the front door; this is the part you read before editing.

---

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
  iqamah-short.mp3         ← real ~51s recording (measured: 51.1s)
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
- **The page unlocks its own audio where the browser allows it** (`probeAutoplay()`). The Fire TV build
  runs in an Android WebView, and android-browser-helper's `WebViewFallbackActivity` calls
  `setMediaPlaybackRequiresUserGesture(false)` — so on that platform audio needs no interaction at all, and
  demanding a remote press on a wall screen would be a barrier with no purpose. The probe tries to start
  the (inaudible) keep-alive; if it plays, audio works and we unlock. Where autoplay is blocked the promise
  rejects, nothing was audible, and the pill goes on asking. It is a capability check, not a way round the
  autoplay rules, and it distinguishes `NotAllowedError` (a real refusal — stop asking) from a
  not-ready-yet failure at boot, which it retries once on `canplaythrough`. The reason is logged either
  way: on a wall screen showing an amber pill, that line is the only clue anyone gets.
- **The sound-enable pill never disappears.** It shows amber "Enable Adhan & Iqamah sound" or green "Sound on
  · tap to test" permanently, and tapping it when already unlocked plays an audible confirmation chime. An
  earlier version hid the pill once tapped with no feedback — that was the direct cause of a real missed Adhan
  in testing, don't reintroduce that pattern.
- **Screen Wake Lock is requested on load, on every `visibilitychange` back to visible, and again whenever
  the lock is released.** iOS Safari gained Wake Lock support in 16.4, so the older "iOS can't do this at
  all" note in this README was out of date — but it changes less than it sounds like, because the spec
  releases the lock whenever the document becomes hidden, and no web page can override the device's own
  power settings. Setting Auto-Lock / screen timeout to Never on the device is still required. See
  "Keeping the audio alive" below.
- **The clock is the masjid's, not the device's.** `masjidNow()` renders everything in `Europe/London`
  whatever timezone the device is set to, so a Fire Stick left on a factory default still shows Bolton's
  times. Without it a misconfigured stick displays a full set of plausible, wrong times on a screen nobody
  is checking — verified: pre-fix, a device on `Australia/Sydney` showed the wrong day and the wrong next
  prayer. It's a no-op on a correctly-configured device, and the detected timezone is logged at boot.
- **A near-silent audio loop plays continuously once sound is enabled**, and the device will show a media
  notification / lock-screen player for it. Both are deliberate — see below.
- **Almost every `clamp()` in the layout has a deliberately low minimum.** Those floors are not
  placeholders. A browser with its own chrome — Silk on a Fire TV — reports a viewport as short as
  960x460, and the original floors (58px logo, 20px prayer times, 18px footer padding) added up to more
  than the height available, so the rows area scrolled and Maghrib and Isha silently did not exist on a
  screen nobody touches. Raising any of these floors reintroduces that. Verified from 1920x1080 down to
  1024x480 with all six prayers visible; below roughly 900x420 the design genuinely cannot show six rows
  legibly, which is well under any real TV. Nothing changes at 720p or above, where `vmin` dominates.
- **Large landscape viewports get noticeably wider padding** (`2.5vh 2.5vw` above 1280px). That's the
  Android TV overscan safe area — plenty of panels crop about 5% off every edge, and the guideline is
  27px/48px at 1080p, which the default `clamp()` padding undershoots. It costs a little margin in a
  desktop browser and saves the clock and footer buttons from being cut off on a TV.
- **The "Created by YSB Designs" credit is absolutely positioned, not a flex child.** That's what keeps it
  from ever changing the hero's height or pushing the countdown around — it contributes no layout at any
  viewport, verified across eight screen sizes. It sits lower-right because every line in that card is
  left-aligned, so the right corner is the only one empty at *all* sizes; a lower-left version collided
  with the "Jamā'ah at ..." line on a portrait tablet. It's plain text rather than a link so the D-pad tab
  order is unchanged, and `pointer-events:none` keeps it clear of taps. Hidden below 420px, where the
  countdown's own digits reach the corner and it would either collide or sit a few pixels off, which reads
  as a mistake rather than a signature.
- **GitHub Pages serves via a case-sensitive filesystem.** A prior deploy broke because folders were named
  `Audio`/`Data` while the code references lowercase `audio`/`data`. If something 404s after a file move/rename
  via GitHub's web editor, check the actual resulting path (a web-editor rename previously left a stray
  `Audio` prefix stuck onto a filename instead of cleanly replacing it) — don't assume the rename did what it
  looked like it did.

## Keeping the audio alive on a device nobody is touching

The failure mode: a tablet is left on the page, the screen dims, the OS backgrounds the browser, JS timers
freeze, and the Adhan never fires — silently, with the page looking perfectly normal when you next pick it
up. Three layers address this, and none of them is optional on its own.

**1. Device power settings — mandatory, and no web page can substitute for them.** Nothing in a browser can
override these:

| Device | Setting |
| --- | --- |
| iPad / iPhone | Settings → Display & Brightness → Auto-Lock → **Never** |
| Android tablet | Settings → Display → Screen timeout → longest available; disable any screen saver |
| Android TV / Google TV | Settings → Device Preferences → Screen saver → **Never** / Off |
| All | Leave it **plugged in** — most devices ignore "never sleep" on battery |

**2. Screen Wake Lock**, requested on load, on return to visible, and on release. Keeps the screen on while
the page is visible. Released automatically when the document becomes hidden, so it covers the "dims while
you're looking at it" case, not the "someone pressed the power button" case.

**3. A near-silent audio keep-alive loop** (`#audio-keepalive`, `startKeepAlive()`), started by the same tap
that unlocks sound. This is the layer that covers the gap between "screen off" and "process suspended": a
page with audio actively playing is treated by both iOS and Android as an active media session and is left
running, so the 1-second trigger tick keeps ticking. Details worth knowing before you touch it:

- The loop is a 0.5s WAV **inlined as a data URI** so it can't 404 and never waits on the network.
- Its samples are about −90 dBFS rather than digital zero — deliberately, because some platforms won't count
  an all-zero stream as active media. It is inaudible.
- It must **not** be `muted`. A muted element is not active media and keeps nothing awake.
- The OS will show a media notification / lock-screen player while it runs. `setUpMediaSession()` gives that
  tile a name ("Adhan & Iqamah — standing by") rather than leaving an anonymous player someone taps stop on.
- If it's paused from the lock screen, that's honoured — but the sound pill flips to amber
  **"Sound paused · tap to resume"**, because the alternative is a green pill lying about a display that can
  no longer sound the Adhan.
- `tick()` restarts it if anything else stops it (a phone call, another app taking audio focus, a cold start
  where the unlock flag survived in `localStorage` but the autoplay permission didn't).

It doubles as the only honest signal the page has that audio output still works at all: if this loop won't
play, the Adhan wouldn't either.

**Why not Background Sync / Periodic Background Sync?** They cannot do this job, for three separate reasons:
a service worker has no DOM and no `<audio>`, so it **cannot play audio at all**; one-shot Background Sync
fires on connectivity being restored, not at a time you choose; and Periodic Background Sync is
Chrome-only, requires an installed PWA, and lets the browser pick the interval — in practice hours, not
"15 minutes before Maghrib". Web Push has the same service-worker audio problem, needs a server this project
doesn't have, and notification sounds are short OS-chosen chimes, not a 3.4-minute Adhan. The keep-alive
above is the approach that actually works from a static page.

`tick()` also logs `[taiyabah] timers were suspended for ~Ns` whenever the gap between ticks exceeds 5s.
That's the first thing to look for in a device's console if someone reports a missed prayer.

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

## Packaging forensics — what's actually inside a generated Android package

Install instructions live in [`android-tv.md`](android-tv.md). This is the evidence behind them: what
was read out of real PWABuilder and Bubblewrap output rather than assumed.

### PWABuilder output

**Step-by-step recipe: [`docs/android-tv.md`](android-tv.md)** — the manifest block to paste, the
keytool/gradle commands, asset links, sideloading, and the TV settings that make it behave as an
always-on display. A stock PWABuilder package has four separate problems on a TV (unsigned; falls back
to Custom Tabs, which TV has no browser for; no `LEANBACK_LAUNCHER` category so it never appears on the
home screen; no banner). All four are read out of a real download in that document.

The plan is a Trusted Web Activity (Chrome wrapper) via **pwabuilder.com**, not a native rewrite. A local
Gradle/Bubblewrap build needs `dl.google.com`, `repo.maven.apache.org` and `services.gradle.org`.
Measured from a sandboxed environment: maven and gradle resolve fine, **`dl.google.com` does not** — and
that's the one hosting the Android SDK and Gradle plugin, so the build dies there. Confirm that host is
reachable before attempting it anywhere restricted.

Known state of the generated package, read out of an actual PWABuilder download rather than assumed:

- **Package ID is `com.taiyabahmasjid.homescreen`.** Verified present in the built `AndroidManifest.xml`.
  This is permanent once published to Play — don't let PWABuilder's `io.github.<user>.twa` default through.
- **The output can be unsigned.** PWABuilder has signed and unsigned modes; the unsigned one ships
  `*-unsigned.apk` / `*-unsigned.aab` and a `Readme.html` redirecting to its `next-steps-unsigned.md`. An
  unsigned APK **cannot be installed** and an unsigned AAB **cannot be uploaded to Play** — if you get
  those filenames, the package is not usable and the signing option needs finding. (Its settings panel is
  a long scrolling form; it renders poorly in mobile Safari, so use a desktop browser for this.)
- **The download does include the Gradle source project** (`build.gradle`, `gradlew`, etc.), contrary to an
  earlier note here that called the output a precompiled binary. That means the Android TV leanback banner
  and `LEANBACK_LAUNCHER` intent-filter can be added in the generated project directly. Neither is present
  in the default output — confirmed absent from the built manifest.
- **Keep `signing.keystore` and `signing-key-info.txt` somewhere permanent and out of this public repo.**
  Lose the key and the app can never be updated; leak it and someone else can ship updates as you.

### Digital Asset Links — the address-bar problem

**Checked per-origin, not per-path.** Because the site lives at
`yameenbux.github.io/Taiyabah-Masjid-HomeSmartScreen/`, `.well-known/assetlinks.json` has to be reachable at
the *root* of `yameenbux.github.io` — which means a separate repo literally named `yameenbux.github.io`, not
this one. Without it the packaged app still installs and runs, it just shows Chrome's address bar; on newer
Chrome it can also crash on launch. **Recommended real fix: move this dashboard to a subdomain of
taiyabahmasjid.com** (e.g. `home.taiyabahmasjid.com`) so `.well-known/` is controllable at that origin's
root.

**If you publish through Google Play, this is a two-step job**, per PWABuilder's own `next-steps.md`: Play
**re-signs the app** with its own key, so the fingerprint in the `assetlinks.json` that came with your
package is no longer the one Android checks. After uploading, go to Play Console → Setup → App integrity,
copy the SHA-256 fingerprint, and add it to `assetlinks.json` alongside the original. Sideloading is the
simple case — the key that signed the APK is the only fingerprint involved.

The `assetlinks.json` prepared earlier alongside `twa-manifest.json` is a **template**: its fingerprint
can't be right, because a fingerprint is derived from a signing key that didn't exist when it was written.
Generate it from your own key — [`android-tv.md`](android-tv.md) has the command.

The three Android TV banner images no longer live only in that zip. `android-tv/make-banners.py`
regenerates them from `logo-cream.png` and the same gradient recipe as the dashboard's own backdrop, so
the launcher tile and the screen it opens actually match:

```bash
python3 android-tv/make-banners.py     # → android-tv/banner-{xhdpi,xxhdpi,xxxhdpi}-*.png
```

### Other platforms

**Amazon Fire TV — still untested, but the blocker is removable.** Fire OS is Android underneath and
installs APKs happily; what it lacks is Chrome and Play Services, and a Trusted Web Activity needs a
Custom-Tabs-capable browser to render. That kills a *stock* TWA build. It does not kill this app, because
`WebViewFallbackActivity` is already bundled in the generated package (verified in the dex) — building with
`fallbackType: webview` renders in Fire OS's own WebView and never asks for Chrome at all.

Two useful consequences of going WebView on Fire TV:

- **Digital Asset Links stop mattering.** Asset links exist to remove the address bar from a Custom Tabs
  TWA. A WebView has no address bar, so the whole `yameenbux.github.io/.well-known/` problem — the one
  pushing toward a custom domain — simply doesn't apply to this build.
- Fire TV needs the same `LEANBACK_LAUNCHER` category as Android TV for a sideloaded app to appear in the
  launcher, so the manifest patch in `docs/android-tv.md` covers both platforms unchanged.

**Check the device before building anything.** Fire TV models from 2025 onward may run **Vega OS**, Amazon's
Linux-based replacement for Fire OS. Vega does not run Android apps at all, and no APK will ever install on
one. Settings → My Fire TV → About will say. Fire OS 7 (Android 9) and Fire OS 8 (Android 11) are both fine
against this app's `minSdk 23`.

Still genuinely untested on hardware — don't promise it to anyone until an APK has actually run on the
mosque's stick.

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
- `test-timezone.js` — loads the page with the browser pinned to five different device timezones and
  asserts every one shows identical prayer data. Run after touching `masjidNow()` or anything date-related.
  It has teeth: against a pre-`masjidNow()` build three of the five fail.
- `test-keepalive.js` — the silent keep-alive loop: silent before unlock, playing and looping and unmuted
  after one tap, self-healing after an external pause, and degrading the pill to an amber warning rather
  than green when audio output is refused. Run after touching `startKeepAlive()` or `updateSoundPill()`.
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
