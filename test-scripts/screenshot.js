const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '../index.html');

// The three shapes this actually gets left running on: a tablet stood up
// on a shelf, the same tablet on its side, and a 1080p TV.
const VIEWPORTS = [
  ['tablet-portrait',  810, 1080],
  ['tablet-landscape', 1180, 820],
  ['tv-1080p',         1920, 1080],
];

(async () => {
  const browser = await chromium.launch();

  for (const [name, width, height] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });

    await page.goto(FILE);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `screenshot-${name}.png` });
    console.log(`${name} (${width}x${height}):`, errors.length === 0 ? 'CLEAN' : JSON.stringify(errors));
    await page.close();
  }

  // Month browser open, at TV size — the densest thing on the page.
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(FILE);
    await page.waitForTimeout(600);
    await page.click('#btn-month');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'screenshot-month-modal.png' });
    const rows = await page.locator('#month-body tr').count();
    console.log('month-modal: rows rendered =', rows);
    await page.close();
  }

  await browser.close();
})();
