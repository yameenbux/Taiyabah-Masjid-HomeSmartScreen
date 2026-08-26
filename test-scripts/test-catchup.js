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

  // Scenario 1: app opened 2 minutes AFTER Zuhr Adhan trigger (13:30, since
  // Zuhr jamaat is 13:45 today 2026-08-20), sound already unlocked from a
  // prior session (localStorage pre-set) -> should catch up and fire.
  {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    await page.addInitScript(() => { try { localStorage.setItem('taiyabah-sound-unlocked','1'); } catch(e){} });
    await page.addInitScript(fakeDateScript('2026-08-20T13:32:00'));
    await page.goto('file://' + path.resolve(__dirname, '../index.html'));
    await page.evaluate(() => {
      window.__played = [];
      for (const id of ['audio-adhan','audio-iqamah']) {
        const el = document.getElementById(id);
        const orig = el.play.bind(el);
        el.play = () => { window.__played.push({id, t: Date.now()}); return orig(); };
      }
    });
    await page.waitForTimeout(1500);
    const played = await page.evaluate(() => window.__played);
    console.log('Scenario 1 (opened 2min late, sound pre-unlocked) — should catch up on Zuhr adhan:', JSON.stringify(played));
    const pillText = await page.textContent('#sound-pill-label');
    console.log('  sound pill label:', pillText);
    await page.screenshot({ path: 'screenshot-catchup-late.png' });
    await page.close();
  }

  // Scenario 2: app opened 5 minutes AFTER the trigger (past the 3-min
  // catch-up window) -> should NOT fire.
  {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    await page.addInitScript(() => { try { localStorage.setItem('taiyabah-sound-unlocked','1'); } catch(e){} });
    await page.addInitScript(fakeDateScript('2026-08-20T13:35:30'));
    await page.goto('file://' + path.resolve(__dirname, '../index.html'));
    await page.evaluate(() => {
      window.__played = [];
      for (const id of ['audio-adhan','audio-iqamah']) {
        const el = document.getElementById(id);
        const orig = el.play.bind(el);
        el.play = () => { window.__played.push({id, t: Date.now()}); return orig(); };
      }
    });
    await page.waitForTimeout(1500);
    const played = await page.evaluate(() => window.__played);
    console.log('Scenario 2 (opened 5.5min late) — should NOT fire (past 3min window):', JSON.stringify(played));
    await page.close();
  }

  // Scenario 3: never tapped sound pill (no localStorage) -> pill visible, nothing plays even at trigger time
  {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    await page.addInitScript(fakeDateScript('2026-08-20T13:45:01'));
    await page.goto('file://' + path.resolve(__dirname, '../index.html'));
    await page.evaluate(() => {
      window.__played = [];
      for (const id of ['audio-adhan','audio-iqamah']) {
        const el = document.getElementById(id);
        const orig = el.play.bind(el);
        el.play = () => { window.__played.push({id, t: Date.now()}); return orig(); };
      }
    });
    await page.waitForTimeout(1500);
    const played = await page.evaluate(() => window.__played);
    const pillHidden = await page.getAttribute('#sound-pill', 'hidden');
    console.log('Scenario 3 (never unlocked) — should NOT fire, pill should be visible:', JSON.stringify(played), 'pill hidden attr:', pillHidden);
    await page.close();
  }

  await browser.close();
})();
