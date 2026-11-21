/* Does the screen know whether the masjid is actually broadcasting?
 *
 * Before this, the only way to find out was to open the stream and watch
 * what happened, which cannot tell "the masjid has finished for the night"
 * apart from "the wifi dropped". Both arrived as a stalled audio element and
 * both got the same hopeful reconnect loop, so a screen sat saying
 * "Reconnecting..." at midnight at a masjid that had gone home.
 *
 * Shoutcast answers it directly: /stats carries streamstatus 1 or 0. These
 * checks drive that endpoint from the test rather than the real masjid, so
 * they are deterministic and run whether or not Bolton is on air.
 *
 * Also covers the volume slider, which did nothing on a real iPad. iOS makes
 * HTMLMediaElement.volume read-only, so the slider has to move a GainNode.
 */
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const wait = ms => new Promise(r => setTimeout(r, ms));

/* Pinned to a quiet hour. Auto-tune opens the stream inside any prayer
   window regardless of this suite's mocked status, so without a fixed clock
   "it did not switch itself on" fails for about three and a half hours a
   day — the same trap test-live fell into. 2026-08-20 10:30 sits in a 7h45
   gap between Fajr and Zuhr. */
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
const QUIET_CLOCK = '2026-08-20T10:30:00';

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};

/* Serve a chosen streamstatus, and a silent but valid MP3 for the stream so
   nothing depends on the masjid being up while the test runs. */
function routes(page, state) {
  return Promise.all([
    page.route('**/stats**', r => r.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ streamstatus: state.onAir ? 1 : 0, currentlisteners: 57 }),
    })),
    page.route('**/stream.mp3**', r => state.streamUp
      ? r.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(64000) })
      : r.abort()),
  ]);
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/London' });

    // ---- the masjid is off air ----
    {
      const page = await ctx.newPage();
      const state = { onAir: false, streamUp: false };
      await routes(page, state);
      await page.addInitScript(fakeDateScript(QUIET_CLOCK));
      await page.addInitScript(() => { try {
        localStorage.setItem('taiyabah-sound-unlocked','1');
        // Pages share a context, so the radio being switched on in an
        // earlier block would otherwise carry into the next one.
        localStorage.removeItem('taiyabah.live.on');
      } catch(e){} });
      await page.goto(FILE, { waitUntil: 'load' });
      await wait(2500);

      check('off air is read from the masjid, not guessed',
        (await page.evaluate(() => LIVE.onAir)) === false);
      const label = await page.textContent('#sound-pill-label');
      check('and said in plain words', /off air/i.test(label), label);
      check('it does not name a fault we did not see',
        !/reconnect|can.t reach|fail/i.test(label), label);
      check('and does not switch itself on into silence',
        (await page.evaluate(() => LIVE.wanted)) === false);

      // asking for it anyway must not start a retry storm
      await page.evaluate(() => liveStart());
      await wait(1500);
      check('asking to listen while off air does not hammer the stream',
        (await page.evaluate(() => LIVE.attempts)) <= 1,
        `attempts=${await page.evaluate(() => LIVE.attempts)}`);
      await page.close();
    }

    // ---- the masjid comes on air ----
    {
      const page = await ctx.newPage();
      const state = { onAir: false, streamUp: true };
      await routes(page, state);
      await page.addInitScript(fakeDateScript(QUIET_CLOCK));
      await page.addInitScript(() => { try {
        localStorage.setItem('taiyabah-sound-unlocked','1');
        // Pages share a context, so the radio being switched on in an
        // earlier block would otherwise carry into the next one.
        localStorage.removeItem('taiyabah.live.on');
      } catch(e){} });
      await page.goto(FILE, { waitUntil: 'load' });
      await wait(2000);
      check('starts off while nobody is broadcasting',
        (await page.evaluate(() => LIVE.wanted)) === false);

      state.onAir = true;                       // the masjid starts broadcasting
      await page.evaluate(() => liveCheckAir());
      await wait(2500);
      check('comes on by itself when the masjid starts, with nothing pressed',
        (await page.evaluate(() => LIVE.wanted)) === true,
        `onAir=${await page.evaluate(() => LIVE.onAir)}`);
      await page.close();
    }

    // ---- the status endpoint is unreachable ----
    {
      const page = await ctx.newPage();
      await page.route('**/stats**', r => r.abort());
      await page.route('**/stream.mp3**', r => r.fulfill({
        status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(64000) }));
      await page.addInitScript(fakeDateScript(QUIET_CLOCK));
      await page.addInitScript(() => { try {
        localStorage.setItem('taiyabah-sound-unlocked','1');
        // Pages share a context, so the radio being switched on in an
        // earlier block would otherwise carry into the next one.
        localStorage.removeItem('taiyabah.live.on');
      } catch(e){} });
      await page.goto(FILE, { waitUntil: 'load' });
      await wait(2500);
      check('an unreachable status endpoint is unknown, never "off air"',
        (await page.evaluate(() => LIVE.onAir)) === null,
        `onAir=${await page.evaluate(() => LIVE.onAir)}`);
      const label = await page.textContent('#sound-pill-label');
      check('and the screen does not claim the masjid has stopped',
        !/off air/i.test(label), label);
      await page.close();
    }

    // ---- the volume slider, which did nothing on an iPad ----
    {
      const page = await ctx.newPage();
      await routes(page, { onAir: true, streamUp: true });
      await page.addInitScript(fakeDateScript(QUIET_CLOCK));
      await page.addInitScript(() => { try {
        localStorage.setItem('taiyabah-sound-unlocked','1');
        // Pages share a context, so the radio being switched on in an
        // earlier block would otherwise carry into the next one.
        localStorage.removeItem('taiyabah.live.on');
      } catch(e){} });
      await page.goto(FILE, { waitUntil: 'load' });
      await wait(2500);
      await page.evaluate(() => { liveStart(); });
      await wait(1200);

      check('the audio runs through a gain node',
        (await page.evaluate(() => !!LIVE.gain)) === true);

      const read = () => page.evaluate(() => LIVE.gain ? +LIVE.gain.gain.value.toFixed(3) : null);
      await page.evaluate(() => { volEl.value = 20; volEl.dispatchEvent(new Event('input')); });
      await wait(200);
      const low = await read();
      await page.evaluate(() => { volEl.value = 90; volEl.dispatchEvent(new Event('input')); });
      await wait(200);
      const high = await read();

      check('moving it down turns the gain down', low !== null && Math.abs(low - 0.20) < 0.02, `gain=${low}`);
      check('moving it up turns the gain up', high !== null && Math.abs(high - 0.90) < 0.02, `gain=${high}`);
      check('so the slider actually changes what you hear', high > low, `${low} -> ${high}`);

      await page.evaluate(() => { volEl.value = 0; volEl.dispatchEvent(new Event('input')); });
      await wait(200);
      check('at zero the screen admits nobody can hear it',
        (await page.evaluate(() => liveAudible())) === false);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(failures
    ? `\nRESULT: ${failures} check(s) failed`
    : '\nRESULT: the screen knows when the masjid is on air, and the volume works');
  process.exitCode = failures ? 1 : 0;
})();
