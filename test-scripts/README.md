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
- **`test-dpad.js`** — drives the page with actual `Tab`/`Enter`/`Escape` key presses to verify: initial
  focus lands somewhere sensible on load, Enter on a footer button opens its modal and moves focus inside,
  Escape closes a modal and restores focus to the button that opened it, Tab and Shift+Tab both wrap around
  inside an open modal instead of escaping it, a click on the dimmed backdrop still closes a modal (that
  moved out of three inline per-modal handlers into the shared `closeModal()` path), and the Ramadan/Eid
  occasion overlay dismisses on Enter. Run this after any change to the modal markup or the
  `openModal`/`closeModal` helpers in `template.html`. Nine numbered checks — all should read `true` /
  the expected element id.
- **`audit.js`** — the broadest check, meant to run against a fresh clone of the *live* deployed site
  (see above), not the local build. Checks for console/page errors on load, confirms the Friday Jumu'ah row
  and Ramadan overlay render, confirms audio actually auto-fires unattended when the clock is faked to a
  trigger moment with sound pre-unlocked via `localStorage`, checks the Service Worker and Wake Lock APIs
  are present, and takes screenshots at three viewport sizes. This is the "did the actual deploy work"
  script — run it after every push to `main`, not just after local changes.

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
