/* Viewport / overflow sweep.
 *
 * The home screen is a display before it is a web page: six prayer times on
 * a wall that nobody walks up to and scrolls. A prayer below the fold, or a
 * jama'ah time spilling over the edge of its own card, does not get noticed
 * for weeks. So this renders every size the thing actually runs at, across
 * several dates, and asserts three things:
 *
 *   1. nothing inside a prayer card escapes that card's box;
 *   2. on display-sized viewports nothing extends past the viewport, and the
 *      page does not scroll;
 *   3. every card in the row renders its times block at the same height.
 *
 * (3) is the one with history. Comparing computed flex-direction is NOT
 * enough: a wrapping row renders as two lines on a card with wide text and
 * one line on a card with narrow text, and the computed value agrees on
 * both. Sunrise — whose times are "7:45 am" and an em dash — was laying
 * itself out differently from the other five for exactly that reason, and
 * a direction check called it fine.
 *
 * Phones are exempt from (2): below 640px wide or 460px tall the page is
 * deliberately allowed to scroll. There the assertion flips — content past
 * the fold must be reachable, i.e. body must not be overflow:hidden.
 *
 * Run after any change to layout CSS:  node test-scripts/test-layout.js
 */
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

const VIEWPORTS = [
  ['1080p TV',        1920, 1080],
  ['720p TV',         1280, 720],
  ['Fire TV Silk',    1280, 672],   // browser chrome eats the bottom
  ['small TV',         960, 540],
  ['tablet portrait',  820, 1180],
  ['tablet 810',       810, 1080],  // the size that once clipped Maghrib + Isha
  ['iPad portrait',    768, 1024],
  ['phone',            390, 844],
  ['phone small',      360, 640],
  ['phone landscape',  844, 390],
];

// today, a Friday, both solstices, an equinox
const DATES = [null, '2026-11-20T11:30:00', '2026-06-21T13:00:00',
               '2026-12-21T16:30:00', '2026-03-20T05:00:00'];

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

(async () => {
  const browser = await chromium.launch();
  let failures = 0;

  for (const [label, width, height] of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1, timezoneId: 'Europe/London',
    });
    const page = await ctx.newPage();
    const problems = [];
    page.on('pageerror', e => problems.push('PAGEERROR: ' + e.message.split('\n')[0]));

    let cards = 0;
    for (const iso of DATES) {
      if (iso) await page.addInitScript(fakeDateScript(iso));
      await page.goto(FILE, { waitUntil: 'load' });
      await page.waitForTimeout(1200);

      const found = await page.evaluate(() => {
        const winH = window.innerHeight, winW = window.innerWidth;
        // must match the breakpoints in template.html
        const mayScroll = winW <= 640 || winH <= 430;
        const probs = [];

        // No column of the times strip may overlap its neighbour.
        const items = [...document.querySelectorAll('.t-item')];
        items.forEach((item, i) => {
          const a = item.getBoundingClientRect();
          const b = items[i + 1]?.getBoundingClientRect();
          if (b && b.top < a.bottom - 1 && b.left < a.right - 1)
            probs.push(`times column ${i} overlaps ${i + 1}`);
          item.querySelectorAll('*').forEach(child => {
            const r = child.getBoundingClientRect();
            if (r.width && (r.right > a.right + 1 || r.left < a.left - 1))
              probs.push(`times column ${i} text spills past its column`);
          });
        });
        // The countdown must stay the dominant element — that is the whole
        // point of the layout, and it is the first thing a well-meaning
        // tweak to a clamp() will quietly break.
        const cd = document.querySelector('.hero-count');
        const rivals = ['.t-jamaah', '.quicklink', '.clock .hm', '.hero-name']
          .map(sel => { const e = document.querySelector(sel);
                        return e ? parseFloat(getComputedStyle(e).fontSize) : 0; });
        const cdSize = cd ? parseFloat(getComputedStyle(cd).fontSize) : 0;
        if (cdSize < Math.max(...rivals) * 1.6)
          probs.push(`countdown ${Math.round(cdSize)}px is not dominant ` +
            `(largest rival ${Math.round(Math.max(...rivals))}px)`);

        for (const sel of ['.chrome','.hero','.daygroup','.times','.quicklinks','.footline']) {
          const el = document.querySelector(sel);
          // A missing selector used to be skipped, which turned a renamed
          // element into a check that quietly stopped running. Fail loudly.
          if (!el) { probs.push(`selector ${sel} matched nothing — test is stale`); continue; }
          const r = el.getBoundingClientRect();
          if (!mayScroll && r.bottom > winH + 1) probs.push(`${sel} runs ${Math.round(r.bottom - winH)}px past the bottom`);
          if (r.right > winW + 1) probs.push(`${sel} runs ${Math.round(r.right - winW)}px past the right edge`);
        }

        // Any element at all running off the right edge, not just the six
        // containers above. A long hijri date inside the chrome overflowed
        // and carried the clock off-screen on a phone while the chrome's own
        // box stayed within bounds, so the container-level check missed it.
        document.querySelectorAll('.app *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          if (r.right > winW + 1.5 || r.left < -1.5)
            probs.push(`${el.className || el.tagName} overflows horizontally ` +
              `(${Math.round(r.left)}..${Math.round(r.right)} vs 0..${winW})`);
        });

        const de = document.documentElement;
        if (!mayScroll && de.scrollHeight > winH + 1) probs.push(`page scrolls (${de.scrollHeight} > ${winH})`);
        if (mayScroll && de.scrollHeight > winH + 1 && getComputedStyle(document.body).overflow === 'hidden')
          probs.push('content past the fold but body is overflow:hidden — unreachable');

        // Every column of the strip must be laid out the same way. Comparing
        // computed styles is not enough — a wrapping row renders as two lines
        // on a wide name and one on a narrow one while the computed value
        // agrees on both. Compare what actually got painted.
        const heights = [...document.querySelectorAll('.t-item')]
          .map(e => Math.round(e.getBoundingClientRect().height));
        if (heights.length && Math.max(...heights) - Math.min(...heights) > 6)
          probs.push(`times columns render at different heights: ${heights.join(', ')}`);

        // The live rule must keep its marker on the rule.
        const rule = document.querySelector('.rule'), now = document.querySelector('.rule-now');
        if (!rule || !now) probs.push('the live rule is missing — test is stale');
        else {
          const rb = rule.getBoundingClientRect(), nb = now.getBoundingClientRect();
          const c = nb.left + nb.width / 2;
          if (c < rb.left - 1 || c > rb.right + 1) probs.push('rule marker is outside the rule');
        }

        // ---- accessibility floors ----
        // A wall display read across a room by a congregation with a lot of
        // elderly people. Nothing here should ever be set at web-body size.
        // On a 720p TV it is the clamp FLOOR that binds rather than the vmin
        // term, and that is the case most likely to regress unnoticed
        // because it still looks fine on a 1080p mock.
        const MIN_TEXT = winW >= 900 ? 15 : 13;
        document.querySelectorAll('.app *').forEach(el => {
          const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
          if (!ownText) return;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
          const px = parseFloat(getComputedStyle(el).fontSize);
          if (px < MIN_TEXT) probs.push(`text at ${px.toFixed(1)}px, floor ${MIN_TEXT}px (${el.className || el.tagName})`);
        });
        // Every control must clear the 44px minimum touch target.
        document.querySelectorAll('.app button, .app a, .app [tabindex]').forEach(el => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          // 43.5 not 44: a control laid out at exactly 44px can measure
          // 43.98 after sub-pixel rounding, which is not a real failure.
          if (r.height < 43.5) probs.push(`control only ${r.height.toFixed(1)}px tall (${el.id || el.className})`);
        });

        return { probs: [...new Set(probs)], cards: document.querySelectorAll('.t-item').length };
      });

      cards = found.cards;
      if (found.cards !== 6) problems.push(`${iso || 'today'}: ${found.cards} times columns, expected 6`);
      problems.push(...found.probs.map(p => `${(iso || 'today').slice(0, 10)}: ${p}`));
    }

    const unique = [...new Set(problems)];
    if (unique.length) {
      failures++;
      console.log(`FAIL  ${label.padEnd(17)} ${width}x${height}`);
      unique.slice(0, 6).forEach(p => console.log(`        ${p}`));
      if (unique.length > 6) console.log(`        …and ${unique.length - 6} more`);
    } else {
      console.log(`PASS  ${label.padEnd(17)} ${width}x${height}  (${cards} times, ${DATES.length} dates)`);
    }
    await ctx.close();
  }

  await browser.close();
  console.log(failures
    ? `\nRESULT: ${failures} viewport(s) with layout problems`
    : `\nRESULT: every viewport keeps the countdown dominant and all six prayers legible`);
  process.exitCode = failures ? 1 : 0;
})();
