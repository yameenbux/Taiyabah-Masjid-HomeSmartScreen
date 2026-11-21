# Test scripts — Taiyabah Home Smart Screen

Playwright scripts used to verify the dashboard during development. Not wired into CI — run manually
after any change to `template.html`, especially anything touching the countdown, audio triggers, occasion
banners, or keyboard/D-pad navigation.

These drive the **built** page, so run `python3 build.py` from the repo root first — editing
`template.html` alone changes nothing these scripts can see.

## Setup

```bash
npm install
npx playwright install chromium
```

Every script pins the browser to `Europe/London` via Playwright's `timezoneId`, so results don't depend
on the timezone of the machine running them — and so the naive timestamps in the fake-Date helpers mean
what they look like they mean (masjid local time).

That second command downloads Playwright's own managed Chromium — the scripts used to hardcode a path to a
sandbox-specific pre-installed browser (`/opt/pw-browsers/...`); that's been removed, they now just call
`chromium.launch()` with no arguments, which works anywhere Playwright is installed normally.

## Where to put this folder

Most of these scripts load `../index.html` — the built page at the repo root, which is what GitHub Pages
serves. Keep this folder at the repo root, or edit the `path.resolve(__dirname, ...)` lines if you'd
rather keep it elsewhere.

`audit.js` is the exception — it deliberately points at a `live-check/index.html` sibling folder instead of
the local build, because its job is to sanity-check the **actually deployed** site. Before
running it:

```bash
git clone https://github.com/yameenbux/Taiyabah-Masjid-HomeSmartScreen.git test-scripts/live-check
```

## What each script checks

- **`screenshot.js`** — screenshots the dashboard at tablet-portrait, tablet-landscape, and 1080p TV
  viewport sizes, plus the month-browser modal open. Quick visual regression check after any layout/CSS
  change.
- **`screenshot-dates.js`** — screenshots four specific simulated dates/states: a Friday (Jumu'ah row),
  mid-Ramadan (occasion overlay), Eid al-Fitr (occasion overlay), and the support modal open. Uses a
  **frozen** fake date (fine here, since nothing needs time to actually advance mid-test — just needs to
  render as of that instant).
- **`test-audio.js`** — starts the clock a few seconds before a real Zuhr Jamā'ah time, taps the sound pill
  to unlock audio, and confirms `audio-iqamah.play()` actually fires at the right moment. Instruments the
  `<audio>` elements' `.play()` method rather than checking for real sound output.
- **`test-catchup.js`** — three scenarios for the 3-minute audio catch-up window: (1) app opened 2 minutes
  after a trigger with sound pre-unlocked → should still fire late, (2) opened 5.5 minutes after → past the
  window, should NOT fire, (3) sound never unlocked at all → should never fire, pill should still be visible.
  This is the script to run if you ever touch `CATCHUP_WINDOW_MS` or the trigger-retry logic.
- **`test-keepalive.js`** — the near-silent audio keep-alive that stops a backgrounded tablet suspending
  the trigger timers. Five checks: nothing plays before the pill is tapped (the keep-alive is not a way
  around the autoplay gesture), one tap starts it looping and unmuted with `currentTime` actually advancing,
  it restarts itself after an external pause (a phone call, another app taking audio focus), the sound pill
  degrades to amber "Sound paused · tap to resume" instead of green when audio output is refused outright,
  and the Media Session tile has a name. Run after any change to `startKeepAlive()`, `updateSoundPill()`, or
  the `#audio-keepalive` element.
- **`test-timezone.js`** — the fleet check. Loads the page with Playwright's `timezoneId` set to five
  different device timezones (London, UTC, New York, Karachi, Sydney) and asserts all five render
  identical prayer data, proving `masjidNow()` renders Bolton's times regardless of how a given Fire
  Stick's clock is configured. Confirms the override actually applied before comparing, so a silently
  ignored `timezoneId` can't produce a false pass, and tolerates the clock differing by a minute
  boundary. Run after any change to `masjidNow()` or the date helpers.
- **`test-dpad.js`** — drives the page with actual `Tab`/`Enter`/`Escape` key presses to verify: initial
  focus lands somewhere sensible on load, Enter on a footer button opens its modal and moves focus inside,
  Escape closes a modal and restores focus to the button that opened it, Tab and Shift+Tab both wrap around
  inside an open modal instead of escaping it, a click on the dimmed backdrop still closes a modal (that
  moved out of three inline per-modal handlers into the shared `closeModal()` path), and the Ramadan/Eid
  occasion overlay dismisses on Enter. Run this after any change to the modal markup or the
  `openModal`/`closeModal` helpers in `template.html`. Nine numbered checks — all should read `true` /
  the expected element id.
- **`test-layout.js`** — the layout safety net. Renders the built `index.html` at ten viewport sizes
  (1080p and 720p TVs, the shorter Fire TV Silk viewport, portrait tablets, phones in both orientations)
  across five dates, and asserts: nothing inside a prayer card escapes that card's box, all six prayers are
  present, nothing on a display-sized viewport runs past the edge or forces the page to scroll, and every
  card in the row renders its times block at the same height. Exits non-zero on failure, so it can gate a
  commit. Run after **any** change to layout CSS in `template.html`.

  The last assertion is the one with history, and it is worth understanding before you weaken it. The
  landscape rule that stacks Begins above Jamā'ah was originally written next to the `.pgrid` landscape
  rule, earlier in the file than the base `.pc-times` rule. A media query adds no specificity, so the later
  unconditional rule won and every card quietly stayed in row mode. It still *looked* right, because the
  wide prayer names wrapped onto two lines anyway — but Sunrise, whose times are `7:45 am` and an em dash,
  was narrow enough to fit one line, so one card in six was laid out differently. Comparing computed
  `flex-direction` would have passed: it agreed on all six. Only comparing rendered heights catches it.
  If you add an assertion here, prove it has teeth by reverting the fix and watching it fail.
- **`test-live.js`** — the live radio, which is the feature that replaces the FM receiver on
  people's kitchen worktops. It checks the recovery path rather than the happy path, because an FM
  radio never drops, never silently dies and never needs restarting, and that is the bar: one tap
  connects and the label names the masjid; the level meter moves and reports "quiet" rather than
  nothing when the hall is silent; with the stream refused it backs off 1/2/4/8/16/30s and says
  plainly that the masjid is off-air **and** that the adhan still plays; when the stream returns it
  reconnects with no interaction; and the recorded adhan is still used whenever live is not carrying
  it. Needs real network access to the host in `data/stream.json` — if that is unreachable it says
  SKIP rather than reporting a pass.

  Its clock is pinned to 10:30 on 2026-08-20, which is a 7h45 gap between Fajr and Zuhr. Without
  that the first assertion — the radio is off until someone switches it on — failed for roughly
  three and a half hours a day, because auto-tune was legitimately opening the stream inside each
  prayer window. A suite that cries wolf on a correct build is worse than no suite.

- **`test-now.js`** — the five minutes a prayer is actually happening. The countdown used to hit
  zero and the hero jumped straight to the next prayer, so the one moment this screen exists for was
  the one moment it never showed. It checks that each jamā'ah holds on "Now" for the configured
  window and then moves on, for all five prayers and Jumu'ah; that Isha rolls into tomorrow's Fajr
  once its window closes; that the eyebrow stops saying "next" while it is happening; and that the
  pulse is dropped for anyone who has asked for reduced motion.

  Every check pins the clock to a real minute of a real day from the repo's own timetable. Note the
  fake clock is offset-based and keeps ticking: an earlier version pinned to one second before
  Maghrib, and page load plus the settle wait pushed the assertion past the jamā'ah so it read "Now"
  — the right answer to the wrong question. Leave margin either side of a boundary.

- **`test-airtime.js`** — whether the screen knows the masjid is actually broadcasting, and
  whether the volume slider does anything. It drives Shoutcast's `/stats` endpoint from the test
  rather than the real masjid, so it is deterministic and runs whether or not Bolton is on air. It
  checks that `streamstatus: 0` is reported as "off air" in those words and stops the retry loop
  rather than hammering a stream nobody is sending; that the radio comes on by itself the moment an
  encoder connects; that an **unreachable** status endpoint is treated as unknown and never
  announced as the masjid having stopped; and that moving the slider moves a GainNode, because on
  iOS `HTMLMediaElement.volume` is read-only and the slider did nothing at all on a real iPad.

  Its clock is pinned to the same quiet gap as `test-live.js`, for the same reason: auto-tune opens
  the stream inside any prayer window regardless of the mocked status, so without a fixed clock the
  "it did not switch itself on" checks fail for about three and a half hours a day.

- **`test-tuner.js`** — the dial that reaches other masjids. Runs offline. It generates a
  multi-station copy of `index.html` next to the real one (so `sky/`, `audio/` and the logo still
  resolve) and deletes it afterwards, which keeps `data/stations.json` empty in the repo until a
  masjid has actually agreed to be listed. It checks that a single-station build shows no dial at
  all; that the picker lists everyone, marks the home masjid and opens with focus on the current
  station rather than on Close; that choosing one moves the stream URL, the label and the amber
  "away" styling together; and the two rules that protect Fajr — a prayer window must not hijack
  someone listening elsewhere, and another masjid being live must **not** suppress our recorded
  adhan. Both of those carry negative controls: auto-tune must still fire on the home masjid, and
  our own live broadcast must still suppress the recording. Without them the first halves would
  pass just as well on a screen where the whole mechanism was dead.

  Two things worth knowing before you change the audio path. The stream URL must be the
  `/stream.mp3` endpoint: the bare host (which the masjid's own website links) returns
  `audio/mpeg` and plays fine in a desktop media player, but browsers reject it with
  `NotSupportedError`, so it fails *silently* in the app. And `crossorigin="anonymous"` on the
  audio element is not optional — without it the analyser that drives the meter reads pure
  silence, because the stream is a different origin.
- **`audit.js`** — the broadest check, meant to run against a fresh clone of the *live* deployed site
  (see above), not the local build. Checks for console/page errors on load, confirms the Friday Jumu'ah row
  and Ramadan overlay render, confirms audio actually auto-fires unattended when the clock is faked to a
  trigger moment with sound pre-unlocked via `localStorage`, checks the Service Worker and Wake Lock APIs
  are present, and takes screenshots at three viewport sizes. This is the "did the actual deploy work"
  script — run it after every push to `main`, not just after local changes. It reads
  `test-scripts/live-check/index.html`, which is deliberately not committed (it is in `.gitignore`): clone
  or download the deployed site into that folder first, otherwise the script fails on a missing file.

## The fake-Date pattern

`test-audio.js`, `test-catchup.js`, `test-dpad.js`, and `audit.js`'s audio-trigger case all need time to
actually *advance* during `page.waitForTimeout()` (so a countdown or a trigger-check tick can fire) — a
plain frozen fake `Date` won't do that. The pattern that works is an **offset**, not a fixed instant:

```js
function fakeDateScript(iso) {
  return `{
    const RealDate = Date;
    const target = new RealDate(${JSON.stringify(iso)}).getTime();
    const offset = target - RealDate.now();
    class FakeDate extends RealDate {
      constructor(...args){ if(args.length===0){ super(RealDate.now()+offset); } else { super(...args); } }
      static now(){ return RealDate.now()+offset; }
    }
    Date = FakeDate;
  }`;
}
// then: await page.addInitScript(fakeDateScript('2026-08-20T13:44:56'));
```

If you swap this for a frozen `new RealDate(iso).getTime()` returned unconditionally, every `Date` call
inside the page returns the exact same instant forever and `waitForTimeout()` never lets a trigger fire —
this exact mistake cost real debugging time once already.

`screenshot-dates.js` uses the simpler frozen version instead, deliberately — it only needs a single
consistent snapshot in time, not a running clock.
