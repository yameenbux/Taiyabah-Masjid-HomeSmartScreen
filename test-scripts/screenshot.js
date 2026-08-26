const { chromium } = require('playwright');
const path = require('path');

const sizes = [
  { name: 'tablet-portrait', width: 810, height: 1080 },
  { name: 'tablet-landscape', width: 1180, height: 820 },
  { name: 'tv-1080p', width: 1920, height: 1080 },
];

(async () => {
  const browser = await chromium.launch();
  const fileUrl = 'file://' + path.resolve(__dirname, '../index.html');
  for (const s of sizes) {
    const page = await browser.newPage({ viewport: { width: s.width, height: s.height }, timezoneId: 'Europe/London' });
    await page.goto(fileUrl);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `screenshot-${s.name}.png` });
    // also open the month modal on the landscape shot to check that overlay
    if (s.name === 'tablet-landscape') {
      await page.click('#btn-month');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `screenshot-month-modal.png` });
    }
    await page.close();
  }
  await browser.close();
  console.log('done');
})();
