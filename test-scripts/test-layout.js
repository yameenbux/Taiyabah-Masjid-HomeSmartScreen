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
        const rivals = ['.t-jamaah', '.quicklink .v', '.clock .hm', '.hero-name']
          .map(sel => { const e = document.querySelector(sel);
                        return e ? parseFloat(getComputedStyle(e).fontSize) : 0; });
        const cdSize = cd ? parseFloat(getComputedStyle(cd).fontSize) : 0;
        if (cdSize < Math.max(...rivals) * 1.6)
          probs.push(`countdown ${Math.round(cdSize)}px is not dominant ` +
            `(largest rival ${Math.round(Math.max(...rivals))}px)`);

        for (const sel of ['.chrome','.hero','.band','.times','.quicklinks','.footline']) {
          const el = document.querySelector(sel); if (!el) continue;
          const r = el.getBoundingClientRect();
          if (!mayScroll && r.bottom > winH + 1) probs.push(`${sel} runs ${Math.round(r.bottom - winH)}px past the bottom`);
          if (r.right > winW + 1) probs.push(`${sel} runs ${Math.round(r.right - winW)}px past the right edge`);
        }

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

        // The band must actually place its marker inside itself.
        const band = document.querySelector('.band'), now = document.querySelector('.band-now');
        if (band && now) {
          const bb = band.getBoundingClientRect(), nb = now.getBoundingClientRect();
          const c = nb.left + nb.width / 2;
          if (c < bb.left - 1 || c > bb.right + 1) probs.push('band marker is outside the band');
        }

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
