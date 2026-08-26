const { chromium } = require('playwright');
const path = require('path');

// Offset, not frozen — the whole point here is that the page's own 1s tick
// has to actually reach the trigger moment while we wait. See README.
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

const FILE = 'file://' + path.resolve(__dirname, '../index.html');

// 2026-08-20 is a Thursday; Zuhr Jama'ah is 13:45, so the full Adhan is due
// at 13:30 and the short Iqamah at 13:45:00 exactly.
const IQAMAH_AT = '2026-08-20T13:44:56';
const ADHAN_AT  = '2026-08-20T13:29:56';

async function run(label, iso, expected) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });

  await page.addInitScript(fakeDateScript(iso));
  await page.goto(FILE);
  await page.waitForTimeout(400);

  // Unlock via a real click on the pill, the way a person would — this is
  // the browser gesture requirement the whole pill exists to satisfy.
  await page.click('#sound-pill');
  await page.waitForTimeout(400);

  // Instrument only AFTER the tap: unlockSound() deliberately plays the
  // Iqamah once as an audible "sound is on" confirmation, and counting
  // that would mask a trigger that never actually fired.
  await page.evaluate(() => {
    window.__played = [];
    for (const id of ['audio-adhan', 'audio-iqamah']) {
      const el = document.getElementById(id);
      const orig = el.play.bind(el);
      el.play = () => { window.__played.push({ id, at: new Date().toTimeString().slice(0, 8) }); return orig(); };
    }
  });

  // 4s of real time = 4s of fake time (offset clock), carrying us past the
  // trigger and giving the retry a tick or two of slack.
  await page.waitForTimeout(6000);

  const played = await page.evaluate(() => window.__played);
  const pill = await page.textContent('#sound-pill-label');
  const ok = played.some(p => p.id === expected);
  console.log(`${label} (clock starts ${iso})`);
  console.log('  played:', JSON.stringify(played));
  console.log('  sound pill label:', pill.trim());
  console.log(`  expected ${expected} to fire:`, ok ? 'PASS' : 'FAIL');
  console.log('  console/page errors:', errors.length === 0 ? 'CLEAN' : JSON.stringify(errors));

  await browser.close();
  return ok;
}

(async () => {
  const a = await run('Iqamah at Zuhr Jama\'ah (13:45)', IQAMAH_AT, 'audio-iqamah');
  const b = await run('Full Adhan 15min before (13:30)', ADHAN_AT, 'audio-adhan');
  console.log('\nRESULT:', a && b ? 'both triggers fired' : 'SOMETHING DID NOT FIRE');
})();
