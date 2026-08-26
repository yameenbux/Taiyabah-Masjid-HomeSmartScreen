const { chromium } = require('playwright');
const path = require('path');

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

const FILE = 'file://' + path.resolve(__dirname, 'live-check/index.html');

async function withPage(browser, iso, fn) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
  if (iso) await page.addInitScript(fakeDateScript(iso));
  await page.goto(FILE);
  await page.waitForTimeout(600);
  await fn(page, errors);
  await page.close();
  return errors;
}

(async () => {
  const browser = await chromium.launch();
  const report = {};

  // 1. Console/runtime errors on plain load (today's real date, no mocking)
  report.consoleErrorsToday = await withPage(browser, null, async (page) => {
    const heroName = await page.textContent('#hero-name');
    const clock = await page.textContent('#clock');
    console.log('  hero-name:', heroName.trim(), '| clock:', clock.trim());
  });

  // 2. Friday / Jumu'ah row substitution
  report.consoleErrorsFriday = await withPage(browser, '2026-08-21T12:00:00', async (page) => {
    const zuhrRowExists = await page.locator('.prow.jummahrow').count();
    console.log('  Friday jummahrow present:', zuhrRowExists > 0);
  });

  // 3. Ramadan occasion overlay
  report.consoleErrorsRamadan = await withPage(browser, '2026-02-25T10:00:00', async (page) => {
    const occHidden = await page.getAttribute('#occasion', 'hidden');
    console.log('  Ramadan overlay visible (hidden attr should be null):', occHidden);
  });

  // 4. Audio trigger fires automatically & unattended (Zuhr today = 2026-08-20, adhan due 13:30)
  report.consoleErrorsAudioTrigger = await withPage(browser, '2026-08-20T13:29:57', async (page, errors) => {
    await page.evaluate(() => { try { localStorage.setItem('taiyabah-sound-unlocked','1'); } catch(e){} });
    await page.reload();
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      window.__played = [];
      for (const id of ['audio-adhan','audio-iqamah']) {
        const el = document.getElementById(id);
        const orig = el.play.bind(el);
        el.play = () => { window.__played.push(id); return orig(); };
      }
    });
    await page.waitForTimeout(4000);
    const played = await page.evaluate(() => window.__played);
    console.log('  Auto-fired (expect audio-adhan):', JSON.stringify(played));
  });

  // 5. Service worker registers without error (needs http, file:// won't register - check for graceful no-op)
  report.consoleErrorsSW = await withPage(browser, null, async (page) => {
    const swSupported = await page.evaluate(() => 'serviceWorker' in navigator);
    console.log('  serviceWorker API present:', swSupported, '(file:// will not actually register - expected)');
  });

  // 6. Wake lock request doesn't throw
  report.consoleErrorsWakeLock = await withPage(browser, null, async (page) => {
    const wl = await page.evaluate(() => 'wakeLock' in navigator);
    console.log('  Wake Lock API present in this browser:', wl);
  });

  // Screenshots at three sizes
  for (const [name, w, h] of [['portrait', 810, 1080], ['landscape', 1180, 820], ['tv', 1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(FILE);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `screenshot-audit-${name}.png` });
    await page.close();
  }

  await browser.close();

  console.log('\n=== ERROR SUMMARY ===');
  for (const [k, v] of Object.entries(report)) {
    console.log(k + ':', v.length === 0 ? 'CLEAN' : JSON.stringify(v));
  }
})();
