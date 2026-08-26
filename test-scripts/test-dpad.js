const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });

  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(500);

  const initialFocus = await page.evaluate(() => document.activeElement.id);
  console.log('1. Initial focus on load (no pointer used):', initialFocus);

  await page.screenshot({ path: 'screenshot-dpad-initial-focus.png' });

  // Tab through the footer buttons like a D-pad moving right
  await page.keyboard.press('Tab');
  let f1 = await page.evaluate(() => document.activeElement.id);
  console.log('2. After 1 Tab:', f1);

  // Press Enter on whatever is focused if it's a stripcard button (open a modal)
  await page.evaluate(() => document.getElementById('btn-month').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const monthOpen = await page.evaluate(() => !document.getElementById('month-wrap').hidden);
  const focusInModal = await page.evaluate(() => document.getElementById('month-wrap').contains(document.activeElement));
  console.log('3. Enter on btn-month -> modal open:', monthOpen, '| focus moved inside modal:', focusInModal, '| focused el:', await page.evaluate(()=>document.activeElement.id));
  await page.screenshot({ path: 'screenshot-dpad-month-modal-focus.png' });

  // Escape should close it and restore focus to the trigger button
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const monthClosed = await page.evaluate(() => document.getElementById('month-wrap').hidden);
  const focusRestored = await page.evaluate(() => document.activeElement.id);
  console.log('4. Escape -> modal closed:', monthClosed, '| focus restored to:', focusRestored, '(expect btn-month)');

  // Focus trap: tab forward past the last focusable element in the modal should wrap to the first
  await page.evaluate(() => document.getElementById('btn-support').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const focusables = await page.evaluate(() => Array.from(document.getElementById('support-wrap').querySelectorAll('button, a[href]')).filter(el=>el.offsetParent!==null).map(el=>el.id||el.textContent.trim()));
  console.log('5. Support modal focusables:', focusables);
  // move focus to last, then Tab forward -> should wrap to first
  await page.evaluate(() => {
    const list = Array.from(document.getElementById('support-wrap').querySelectorAll('button, a[href]')).filter(el=>el.offsetParent!==null);
    list[list.length-1].focus();
  });
  await page.keyboard.press('Tab');
  const afterWrap = await page.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim());
  console.log('6. Tab from last focusable in modal wraps to:', afterWrap);
  // Shift+Tab from the first focusable should wrap backwards to the last
  await page.evaluate(() => {
    const list = Array.from(document.getElementById('support-wrap').querySelectorAll('button, a[href]')).filter(el=>el.offsetParent!==null);
    list[0].focus();
  });
  await page.keyboard.press('Shift+Tab');
  const afterBackWrap = await page.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim());
  console.log('7. Shift+Tab from first focusable in modal wraps to:', afterBackWrap);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Clicking the dimmed backdrop (not the modal itself) still closes it —
  // this moved from three inline per-modal handlers into the shared
  // closeModal() path, so it's worth asserting it survived.
  await page.evaluate(() => document.getElementById('btn-contact').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.mouse.click(8, 8); // top-left corner = backdrop, never the modal
  await page.waitForTimeout(250);
  const contactClosed = await page.evaluate(() => document.getElementById('contact-wrap').hidden);
  console.log('8. Backdrop click closes contact modal:', contactClosed);

  // Occasion overlay keyboard dismissal (simulate Ramadan date via reload w/ fake date not needed here;
  // just directly unhide it to test the keydown handler in isolation)
  await page.evaluate(() => {
    const occ = document.getElementById('occasion');
    document.getElementById('occasion-title').textContent = 'Test';
    occ.hidden = false;
    occ.focus();
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const occHiddenAfterEnter = await page.evaluate(() => document.getElementById('occasion').hidden);
  console.log('9. Occasion overlay dismissed via Enter key:', occHiddenAfterEnter);

  console.log('\nConsole/page errors:', errors.length === 0 ? 'CLEAN' : JSON.stringify(errors));

  await browser.close();
})();
