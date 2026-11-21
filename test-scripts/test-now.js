/* The five minutes a prayer is actually happening.
 *
 * The countdown used to hit zero and the hero jumped straight to the next
 * prayer, so the one moment this screen exists for was the one moment it
 * never showed. Somebody walking into the kitchen at 4:09 saw a countdown to
 * Isha and nothing to say Maghrib had just begun.
 *
 * Every check here pins the clock to a real minute of a real day from the
 * repo's own timetable, so "one second before" and "one second after" mean
 * what they say.
 *
 * 2026-08-20 (Thu) jamaa'ah: Fajr 05:20, Zuhr 13:45, Asr 19:15,
 *                            Maghrib 20:32, Isha 22:15
 * 2026-08-21 (Fri) Jumu'ah 13:30, Fajr 05:30
 */
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

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

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 1024 }, timezoneId: 'Europe/London' });

    async function at(iso) {
      const page = await ctx.newPage();
      await page.addInitScript(fakeDateScript(iso));
      await page.route('**/stats**', r => r.abort());      // keep the radio out of this
      await page.goto(FILE, { waitUntil: 'load' });
      await page.waitForTimeout(900);
      const s = await page.evaluate(() => ({
        eyebrow: document.getElementById('hero-k').textContent.trim(),
        name: document.getElementById('hero-name').textContent.trim(),
        count: document.getElementById('hero-countdown').textContent.trim(),
        at: document.getElementById('hero-at').textContent.trim(),
        isNow: document.getElementById('hero-countdown').classList.contains('is-now'),
        anim: getComputedStyle(document.getElementById('hero-countdown')).animationName,
      }));
      await page.close();
      return s;
    }

    // ---- just before Maghrib ----
    /* Ten seconds, not one. The fake clock is offset-based so it keeps
       ticking, and page load plus the settle wait is over a second: pinning
       to 20:31:59 meant the assertion ran at 20:32:00 and read "Now", which
       is the right answer to the wrong question. */
    let s = await at('2026-08-20T20:31:50');
    check('just before Maghrib it is still counting down',
      /Maghrib/.test(s.name) && /^00:00:0\d$/.test(s.count) && !s.isNow,
      `${s.name} ${s.count}`);

    // ---- the moment it starts ----
    s = await at('2026-08-20T20:32:00');
    check('the moment Maghrib starts it says Now, not 00:00:00',
      /Maghrib/.test(s.name) && s.count === 'Now', `${s.name} "${s.count}"`);
    check('and the eyebrow stops saying "next"',
      /^Jam/.test(s.eyebrow) && !/next/i.test(s.eyebrow), s.eyebrow);
    check('and it says when it started', /started at/i.test(s.at), s.at);
    check('and it pulses', s.isNow && s.anim === 'nowPulse', `anim=${s.anim}`);

    // ---- still holding near the end of the window ----
    s = await at('2026-08-20T20:36:55');
    check('still on Maghrib at 4m55s', /Maghrib/.test(s.name) && s.count === 'Now',
      `${s.name} "${s.count}"`);

    // ---- the window closes ----
    s = await at('2026-08-20T20:37:05');
    check('at 5m05s it moves on to Isha',
      /Isha/.test(s.name) && !s.isNow && /^\d\d:\d\d:\d\d$/.test(s.count),
      `${s.name} ${s.count}`);
    check('and the eyebrow says "next" again', /next/i.test(s.eyebrow), s.eyebrow);

    // ---- every prayer, not just Maghrib ----
    for (const [name, iso] of [['Fajr','2026-08-20T05:22:00'], ['Zuhr','2026-08-20T13:47:00'],
                               ['Asr','2026-08-20T19:17:00'], ['Isha','2026-08-20T22:17:00']]) {
      s = await at(iso);
      check(`${name} holds too`, new RegExp(name).test(s.name) && s.count === 'Now',
        `${s.name} "${s.count}"`);
    }

    // ---- the last prayer rolls into tomorrow once its window closes ----
    s = await at('2026-08-20T22:21:00');
    check('after Isha it rolls to tomorrow\'s Fajr',
      /Fajr/.test(s.name) && /tomorrow/i.test(s.at) && !s.isNow, `${s.name} · ${s.at}`);

    // ---- Jumu'ah is a jamaa'ah like any other ----
    s = await at('2026-08-21T13:32:00');
    check('Jumu\'ah holds on Now as well',
      /Jumu/.test(s.name) && s.count === 'Now', `${s.name} "${s.count}"`);

    // ---- a still screen for anyone who asked for one ----
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(fakeDateScript('2026-08-20T20:32:30'));
    await page.route('**/stats**', r => r.abort());
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const rm = await page.evaluate(() => {
      const e = document.getElementById('hero-countdown');
      return { text: e.textContent.trim(), anim: getComputedStyle(e).animationName,
               op: getComputedStyle(e).opacity };
    });
    check('reduced motion still says Now, but holds still',
      rm.text === 'Now' && rm.anim === 'none' && rm.op === '1',
      `anim=${rm.anim} opacity=${rm.op}`);
    await page.close();
  } finally {
    await browser.close();
  }

  console.log(failures
    ? `\nRESULT: ${failures} check(s) failed`
    : '\nRESULT: the screen holds on a prayer while it is happening, and says so');
  process.exitCode = failures ? 1 : 0;
})();
