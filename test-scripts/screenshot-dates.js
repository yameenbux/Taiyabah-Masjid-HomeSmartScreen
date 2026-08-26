const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '../index.html');

// Deliberately FROZEN, unlike the offset pattern used everywhere else —
// see test-scripts/README.md. Nothing here needs the clock to advance;
// each case just has to render as of one instant, and freezing keeps the
// screenshots byte-stable between runs (a running clock would change the
// countdown digits every time and make every diff look like a change).
function frozenDateScript(iso) {
  return `{
    const RealDate = Date;
    const fixed = new RealDate(${JSON.stringify(iso)}).getTime();
    class FakeDate extends RealDate {
      constructor(...args){ if(args.length===0){ super(fixed); } else { super(...args); } }
      static now(){ return fixed; }
    }
    Date = FakeDate;
  }`;
}

const CASES = [
  // 2026-08-21 is a Friday — the Zuhr row is replaced by the Jumu'ah row.
  { name: 'friday-jummah', iso: '2026-08-21T11:00:00' },
  // 16 Ramadan 1447 — mid-month, so the Ramadan overlay is up.
  { name: 'ramadan',       iso: '2026-03-05T10:00:00' },
  // 1 Shawwal 1447 — Eid al-Fitr overlay.
  { name: 'eid-fitr',      iso: '2026-03-20T09:00:00' },
];

(async () => {
  const browser = await chromium.launch();

  for (const c of CASES) {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });

    await page.addInitScript(frozenDateScript(c.iso));
    await page.goto(FILE);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `screenshot-date-${c.name}.png` });

    const jummahRow = await page.locator('.prow.jummahrow').count();
    const occHidden = await page.getAttribute('#occasion', 'hidden');
    console.log(
      `${c.name} (${c.iso}) — jummah row: ${jummahRow > 0}, occasion overlay up: ${occHidden === null}`,
      errors.length === 0 ? '| CLEAN' : '| ' + JSON.stringify(errors)
    );
    await page.close();
  }

  // Support / New Build modal, with the real bank details rendered.
  {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    await page.addInitScript(frozenDateScript('2026-08-20T14:00:00'));
    await page.goto(FILE);
    await page.waitForTimeout(500);
    await page.click('#btn-support');
    await page.waitForTimeout(350);
    await page.screenshot({ path: 'screenshot-date-support-modal.png' });
    const fields = await page.locator('#support-body .bankgrid .v').count();
    console.log('support-modal — bank fields rendered:', fields, '(expect 4)');
    await page.close();
  }

  await browser.close();
})();
