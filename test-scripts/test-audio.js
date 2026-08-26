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

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  page.on('pageerror', err => logs.push('PAGEERROR: ' + err.message));

  // Start 14:59:56 on Wed 19 Aug 2026 (Asr jamaat = 19:15, so not that).
  // Use a moment 5s before Zuhr jamaat (13:45) on a non-Friday: 2026-08-20 (Thursday).
  await page.addInitScript(fakeDateScript('2026-08-20T13:44:56'));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(500);

  // Unlock sound (simulates the user's one tap)
  await page.click('#sound-pill');
  await page.waitForTimeout(300);

  // Instrument the audio elements to report play() calls
  await page.evaluate(() => {
    window.__played = [];
    for (const id of ['audio-adhan','audio-iqamah']) {
      const el = document.getElementById(id);
      const orig = el.play.bind(el);
      el.play = () => { window.__played.push({id, t: Date.now()}); return orig(); };
    }
  });

  console.log('Waiting through Zuhr jamaat (13:45) to see iqamah fire...');
  await page.waitForTimeout(9000); // real 9s covers fake 13:44:56 -> 13:45:05

  const played = await page.evaluate(() => window.__played);
  console.log('Played events (should include audio-iqamah near 13:45:00):', JSON.stringify(played));

  console.log('Console logs:', logs.filter(l=>l.includes('PAGEERROR')));

  await page.screenshot({ path: 'screenshot-audio-test.png' });
  await browser.close();
})();
