const { chromium } = require('playwright');
const path = require('path');

function fakeDateScript(iso) {
  return `{
    const RealDate = Date;
    const fixed = new RealDate(${JSON.stringify(iso)});
    class FakeDate extends RealDate {
      constructor(...args){ if(args.length===0){ super(fixed.getTime()); } else { super(...args); } }
      static now(){ return fixed.getTime(); }
    }
    Date = FakeDate;
  }`;
}

const cases = [
  { name: 'friday', iso: '2026-08-21T13:00:00', desc: 'Friday Aug 21 2026, before Jumuah' },
  { name: 'ramadan', iso: '2026-02-25T10:00:00', desc: 'mid-Ramadan 2026' },
  { name: 'eid-fitr', iso: '2026-03-20T09:00:00', desc: 'Eid al-Fitr 1 Shawwal 2026' },
  { name: 'support-modal', iso: '2026-08-19T15:25:00', desc: 'support modal open' },
];

(async () => {
  const browser = await chromium.launch();
  const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');
  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    await page.addInitScript(fakeDateScript(c.iso));
    await page.goto(fileUrl);
    await page.waitForTimeout(500);
    if (c.name === 'support-modal') {
      await page.click('#btn-support');
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `screenshot-${c.name}.png` });
    await page.close();
  }
  await browser.close();
  console.log('done');
})();
