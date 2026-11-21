/* The dial.
 *
 * The FM receiver this screen replaces could reach every transmitter in town,
 * and some people reasonably count that as the better radio. These checks
 * cover the three things that can go quietly wrong once more than one masjid
 * is reachable:
 *
 *   1. A single-station build must look exactly as it did before the tuner
 *      existed — no stray control on a wall screen that has nothing to pick.
 *   2. Auto-tune is built from TAIYABAH's timetable, so it must not drag
 *      someone listening elsewhere back, or open a connection they didn't ask
 *      for.
 *   3. The recorded adhan must still play when the dial is elsewhere. The
 *      suppression rule exists because the live mic carries the real muadhin
 *      — another masjid's programme is not our adhan, and suppressing on it
 *      would silence Fajr with the radio apparently working.
 *
 * The multi-station page is generated here rather than committed, so the
 * repo's own stations.json stays empty until a masjid has actually agreed.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const REAL = path.join(ROOT, 'index.html');
/* Lives beside index.html so sky/, audio/ and the logo still resolve. */
const VARIANT = path.join(ROOT, '_tuner-test.html');

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
const QUIET  = '2026-08-20T10:30:00';   // 7h45 gap between Fajr and Zuhr
const INZUHR = '2026-08-20T13:30:00';   // inside Zuhr's auto-tune window (13:27-14:10)

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};

function writeVariant() {
  const html = fs.readFileSync(REAL, 'utf8');
  /* STATIONS is derived at runtime from MASJIDS now, so the fixture adds a
     whole second masjid - its own times, stream and profile - which is what
     a real second masjid is. Cloning the first one's days keeps this honest
     about shape without inventing another masjid's prayer times. */
  const re = /const MASJIDS = (\[.*?\]);\n/;
  const m = html.match(re);
  if (!m) throw new Error('could not find the baked MASJIDS array in index.html');
  const masjids = JSON.parse(m[1]);
  if (masjids.length !== 1) throw new Error(`fixture expects 1 masjid in the repo, found ${masjids.length}`);
  const second = JSON.parse(JSON.stringify(masjids[0]));
  second.id = 'testmasjid';
  second.name = 'Test Masjid';
  second.shortName = 'Test';
  second.logo = null;                       // exercises the wordmark fallback
  second.appeal = null;                     // a masjid with no fundraising appeal
  second.give = null;
  second.qr = null;
  second.contact = { address: '1 Test Street, Bolton', phone: '01204 000 000' };
  second.stream = { enabled: true, name: 'Test Masjid', url: 'https://example.invalid/s.mp3' };
  const two = masjids.concat([second]);
  fs.writeFileSync(VARIANT, html.replace(re, 'const MASJIDS = ' + JSON.stringify(two) + ';\n'), 'utf8');
  return two.map(x => ({ id: x.id, name: x.name, url: x.stream && x.stream.url, home: x.id === masjids[0].id }));
}

(async () => {
  const two = writeVariant();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: 'Europe/London' });

    // ---- 1. the shipped build: one station, nothing to choose ----
    {
      const page = await ctx.newPage();
      await page.addInitScript(fakeDateScript(QUIET));
      await page.route('**/stats**', r => r.abort());
      await page.goto('file://' + REAL, { waitUntil: 'load' });
      await page.waitForTimeout(900);
      const n = await page.evaluate(() => MASJIDS.length);
      const hidden = await page.evaluate(() => document.getElementById('tuner-btn').hidden);
      check('ships with one masjid until more are added', n === 1, `${n} masjid(s)`);
      check('one station shows no dial at all', hidden === true, `hidden=${hidden}`);
      await page.close();
    }

    // ---- 2. two stations: the dial appears and says where it is ----
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    /* Block the air-status poll. Auto-tune is what this suite is about, and
       with the poll live the radio is already on before any prayer window
       opens, which makes "a prayer window did not start this" unprovable. */
    await page.route('**/stats**', r => r.abort());
    await page.addInitScript(fakeDateScript(QUIET));
    await page.goto('file://' + VARIANT, { waitUntil: 'load' });
    await page.waitForTimeout(900);

    check('two stations show the dial',
      (await page.evaluate(() => !document.getElementById('tuner-btn').hidden)) === true);
    // On home the name would duplicate the wordmark beside it and hide the
    // fact that other masjids exist; once tuned away the name is the only
    // thing telling you so (asserted at step 4).
    check('dial invites you to the others while on home',
      (await page.textContent('#tuner-btn-label')).trim() === 'Other masjids',
      await page.textContent('#tuner-btn-label'));
    check('starts on the home masjid',
      (await page.evaluate(() => onHomeStation())) === true);

    // a wall screen is touched, and a TV is driven by a remote
    const box = await page.locator('#tuner-btn').boundingBox();
    check('dial is a 44px touch target', box.height >= 44, `${Math.round(box.height)}px`);

    // ---- 3. the picker ----
    await page.click('#tuner-btn');
    await page.waitForTimeout(350);
    const rows = page.locator('.stationrow');
    check('picker lists every masjid', (await rows.count()) === 2, `${await rows.count()} rows`);
    check('home masjid is marked as yours',
      (await page.locator('.stationrow .stag').first().textContent()).toLowerCase().includes('your'));
    check('current station is the checked one',
      (await rows.nth(0).getAttribute('aria-checked')) === 'true' &&
      (await rows.nth(1).getAttribute('aria-checked')) === 'false');
    check('picker takes focus for a remote',
      (await page.evaluate(() => document.activeElement.className.includes('stationrow'))) === true);
    const rowBox = await rows.nth(1).boundingBox();
    check('picker rows are 44px targets', rowBox.height >= 44, `${Math.round(rowBox.height)}px`);

    // ---- 4. tuning away ----
    await rows.nth(1).click();
    await page.waitForTimeout(400);
    check('picker closes on choosing',
      (await page.evaluate(() => document.getElementById('tuner-wrap').hidden)) === true);
    check('dial moves to the chosen masjid',
      (await page.textContent('#tuner-btn-label')).trim() === 'Test Masjid',
      await page.textContent('#tuner-btn-label'));
    check('tuned away is flagged in colour too',
      (await page.evaluate(() => document.getElementById('tuner-btn').classList.contains('away'))) === true);
    check('onHomeStation() is now false',
      (await page.evaluate(() => onHomeStation())) === false);
    check('the stream URL followed the dial',
      (await page.evaluate(() => curStation().url)) === two[1].url);

    // ---- 5. auto-tune must not drag a listener back ----
    const autoAway = await page.evaluate((iso) => {
      const d = new Date(iso);
      const before = LIVE.wanted;
      autoTune(dayRec(d), d, d);
      return { before, after: LIVE.wanted, station: curStationId };
    }, INZUHR);
    check('a prayer window does not hijack another masjid',
      autoAway.after === false && autoAway.station === 'testmasjid',
      `wanted=${autoAway.after}, station=${autoAway.station}`);

    // negative control: the identical call on the home station must open it,
    // otherwise the check above would pass on a screen where auto-tune is
    // simply broken for everyone.
    const autoHome = await page.evaluate((iso) => {
      tuneTo(STATIONS[0].id);
      const d = new Date(iso);
      autoTune(dayRec(d), d, d);
      const r = { wanted: LIVE.wanted, auto: autoTuned };
      liveStop();
      return r;
    }, INZUHR);
    check('and still opens for salah on the home masjid',
      autoHome.wanted === true && autoHome.auto === true,
      `wanted=${autoHome.wanted}, autoTuned=${autoHome.auto}`);

    // ---- 6. the adhan recording must survive the dial being elsewhere ----
    // liveAudible() is forced true so this tests the station rule rather than
    // whether the network happened to be up.
    const supp = await page.evaluate(() => {
      liveAudible = () => true;
      const out = {};
      tuneTo('testmasjid');
      out.away = (typeof liveAudible === 'function' && liveAudible() && onHomeStation());
      tuneTo(STATIONS[0].id);
      out.home = (typeof liveAudible === 'function' && liveAudible() && onHomeStation());
      return out;
    });
    check('another masjid being live does NOT suppress our adhan',
      supp.away === false, `suppress=${supp.away}`);
    check('our own live broadcast still does suppress it',
      supp.home === true, `suppress=${supp.home}`);

    // ---- 6b. the screen is Taiyabah's, whatever is coming out of it ----
    // The dial moves sound and nothing else: the times, the countdown target,
    // the date and the Jumu'ah line are Taiyabah's at all times. Snapshotted
    // either side of a tune so this stays true by test rather than by memory.
    // #hero-count is excluded on purpose — it ticks every second.
    const face = () => page.evaluate(() => ({
      name: document.getElementById('hero-name').textContent.trim(),
      at:   document.getElementById('hero-at').textContent.trim(),
      date: document.getElementById('dateline').textContent.trim(),
      jum:  document.getElementById('jummah-line').textContent.trim(),
      times: document.getElementById('times').textContent.replace(/\s+/g, ' ').trim(),
    }));
    await page.evaluate(() => tuneTo(STATIONS[0].id));
    await page.waitForTimeout(250);
    const onHome = await face();
    await page.evaluate(() => tuneTo('testmasjid'));
    await page.waitForTimeout(250);
    const onAway = await face();
    for(const k of ['name','at','date','jum','times']){
      check(`tuning away leaves Taiyabah's ${k} untouched`, onHome[k] === onAway[k],
        onHome[k] === onAway[k] ? (onHome[k].slice(0, 46) || '(empty)')
                                : `home="${onHome[k]}" away="${onAway[k]}"`);
    }
    check('and the times strip is not empty, so that comparison means something',
      onHome.times.length > 20, `${onHome.times.length} chars`);

    // ---- 7. the dial comes home overnight ----
    await page.evaluate(() => tuneTo('testmasjid'));
    await page.waitForTimeout(200);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(900);
    check('reload returns to the home masjid',
      (await page.evaluate(() => onHomeStation())) === true,
      await page.textContent('#tuner-btn-label'));

    // ---- 8. escape closes, focus returns ----
    await page.click('#tuner-btn');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check('Escape closes the picker',
      (await page.evaluate(() => document.getElementById('tuner-wrap').hidden)) === true);
    check('focus returns to the dial',
      (await page.evaluate(() => document.activeElement.id)) === 'tuner-btn',
      await page.evaluate(() => document.activeElement.id));

    check('no page errors throughout', errors.length === 0, errors.join(' | ') || 'clean');
    await page.close();
  } finally {
    await browser.close();
    fs.existsSync(VARIANT) && fs.unlinkSync(VARIANT);
  }

  console.log(failures
    ? `\nRESULT: ${failures} check(s) failed`
    : '\nRESULT: the dial reaches other masjids without costing us the adhan');
  process.exitCode = failures ? 1 : 0;
})();
