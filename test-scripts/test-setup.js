/* Out-of-box setup, and the promise it makes.
 *
 * The screen is handed to a household in a box. Everything here is about the
 * ten minutes after they open it, and about the one claim the setup screen
 * makes out loud: "your times, your adhan and your jama'ah will all come from
 * the masjid you pick." If picking a masjid did not actually move the times,
 * that sentence would be a lie told to someone who then missed Fajr.
 *
 * The wifi step is checked twice: with Fully present (it must hand over to
 * Android's own picker and come back by itself) and without (it must say what
 * to do rather than pretend a dead button worked).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const REAL = path.join(ROOT, 'index.html');
const VARIANT = path.join(ROOT, '_setup-test.html');

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};

/* A second masjid with DIFFERENT jama'ah times, so "the times followed the
   choice" is a real comparison rather than two identical strings. */
function writeVariant() {
  const html = fs.readFileSync(REAL, 'utf8');
  const re = /const MASJIDS = (\[.*?\]);\n/;
  const m = html.match(re);
  if (!m) throw new Error('could not find the baked MASJIDS array');
  const masjids = JSON.parse(m[1]);
  const other = JSON.parse(JSON.stringify(masjids[0]));
  other.id = 'othermasjid';
  other.name = 'Other Masjid';
  other.shortName = 'Other';
  other.logo = null;      // no artwork supplied -> wordmark
  other.appeal = null;    // no fundraising appeal -> no support button
  other.give = null;
  other.qr = null;
  other.contact = { address: '1 Test Street, Bolton' };
  other.stream = { enabled: true, name: 'Other Masjid', url: 'https://example.invalid/o.mp3' };
  // shift every jama'ah by 7 minutes
  for (const d of Object.keys(other.days)) {
    const j = other.days[d].jamaat;
    for (const k of Object.keys(j)) {
      const [hh, mm] = j[k].split(':').map(Number);
      const t = (hh * 60 + mm + 7) % 1440;
      j[k] = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    }
  }
  const all = masjids.concat([other]);
  fs.writeFileSync(VARIANT, html.replace(re, 'const MASJIDS = ' + JSON.stringify(all) + ';\n'), 'utf8');
  return all;
}

// A stand-in for the Fully Kiosk JavaScript interface, which only exists on a
// provisioned tablet. Records what the page asked it to do.
const fullyStub = `
  window.__fullyCalls = [];
  window.__wifiOn = false;
  window.fully = {
    openWifiSettings(){ window.__fullyCalls.push('openWifiSettings'); window.__wifiOn = true; },
    isWifiConnected(){ return window.__wifiOn; },
    getWifiSsid(){ return window.__wifiOn ? '"Home-WiFi"' : ''; }
  };`;

(async () => {
  const all = writeVariant();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/London' });

    // ---- 1. a plain visitor and the masjid's wall screens never see setup ----
    {
      const page = await ctx.newPage();
      await page.goto('file://' + REAL, { waitUntil: 'load' });
      await page.waitForTimeout(700);
      check('no setup on a normal load', (await page.evaluate(() => document.getElementById('setup').hidden)) === true);
      check('and it still shows the default masjid',
        (await page.evaluate(() => MASJID.id)) === 'taiyabah', await page.evaluate(() => MASJID.id));
      await page.close();
    }

    // ---- 2. an unprovisioned device (Fully present, nothing stored) runs it ----
    {
      const page = await ctx.newPage();
      await page.addInitScript(fullyStub);
      await page.goto('file://' + VARIANT, { waitUntil: 'load' });
      await page.waitForTimeout(700);
      check('a new device opens setup by itself',
        (await page.evaluate(() => document.getElementById('setup').hidden)) === false);
      await page.close();
    }

    // ---- 3. the whole flow, on a device ----
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(fullyStub);
    await page.goto('file://' + VARIANT + '?setup=1', { waitUntil: 'load' });
    await page.waitForTimeout(700);

    check('starts on welcome',
      (await page.evaluate(() => document.querySelector('.setup-step[data-step="0"]').hidden)) === false);
    const btn = await page.locator('[data-go="1"]').boundingBox();
    check('buttons are a 44px target', btn.height >= 44, `${Math.round(btn.height)}px`);

    await page.click('[data-go="1"]');
    await page.waitForTimeout(400);
    check('welcome leads to wifi',
      (await page.evaluate(() => document.querySelector('.setup-step[data-step="1"]').hidden)) === false);
    check('says it is not connected yet',
      /not connected/i.test(await page.textContent('#setup-wifi-state')),
      await page.textContent('#setup-wifi-state'));

    // hands over to Android rather than faking a wifi picker in the page
    await page.click('#setup-wifi-btn');
    await page.waitForTimeout(3200);
    check('hands over to Android wifi settings',
      (await page.evaluate(() => window.__fullyCalls)).includes('openWifiSettings'));
    check('names the network once joined',
      /Home-WiFi/.test(await page.textContent('#setup-wifi-state')),
      await page.textContent('#setup-wifi-state'));
    check('moves on by itself once connected, with nothing to press',
      (await page.evaluate(() => document.querySelector('.setup-step[data-step="2"]').hidden)) === false);

    // ---- 4. the claim the setup screen makes ----
    const before = await page.evaluate(() => ({
      id: MASJID.id,
      times: document.getElementById('times').textContent.replace(/\s+/g, ' ').trim(),
      brand: document.getElementById('brandslot').textContent.trim(),
    }));
    const rows = page.locator('#setup-masjids .stationrow');
    check('lists every masjid to choose from', (await rows.count()) === all.length, `${await rows.count()} rows`);
    await rows.nth(all.length - 1).click();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => ({
      id: MASJID.id,
      times: document.getElementById('times').textContent.replace(/\s+/g, ' ').trim(),
      brand: document.getElementById('brandslot').textContent.trim(),
      title: document.title,
    }));
    check('choosing a masjid selects it', after.id === 'othermasjid', after.id);
    check('THE TIMES FOLLOW THE CHOICE', after.times !== before.times && after.times.length > 20,
      after.times === before.times ? 'times did not change — the setup screen would be lying' : 'changed');
    check('the screen is named for the chosen masjid', after.brand === 'Other Masjid', after.brand);
    check('and so is the page title', /Other Masjid/.test(after.title), after.title);

    // a masjid with no appeal and no QR must simply not show them
    check('no appeal means no support button',
      (await page.evaluate(() => document.getElementById('btn-support').hidden)) === true);
    check('no QR means no donation block',
      (await page.evaluate(() => document.getElementById('donate').hidden)) === true);
    check('but its contact details are its own',
      /Test Street/.test(await page.textContent('#contact-body')), await page.textContent('#contact-body'));

    // ---- 5. finish, and stay chosen ----
    check('lands on the confirmation',
      (await page.evaluate(() => document.querySelector('.setup-step[data-step="3"]').hidden)) === false);
    check('confirmation names the masjid',
      /Other Masjid/.test(await page.textContent('#setup-done-p')), await page.textContent('#setup-done-p'));
    await page.click('#setup-finish');
    await page.waitForTimeout(500);
    check('setup closes', (await page.evaluate(() => document.getElementById('setup').hidden)) === true);

    await page.goto('file://' + VARIANT, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    check('the choice survives a reboot', (await page.evaluate(() => MASJID.id)) === 'othermasjid',
      await page.evaluate(() => MASJID.id));
    check('and setup does not run again',
      (await page.evaluate(() => document.getElementById('setup').hidden)) === true);

    check('no page errors throughout', errors.length === 0, errors.join(' | ') || 'clean');
    await page.close();

    // ---- 6. no Fully: the step must be honest, not a dead button ----
    {
      const page2 = await ctx.newPage();
      await page2.goto('file://' + VARIANT + '?setup=1', { waitUntil: 'load' });
      await page2.waitForTimeout(600);
      await page2.click('[data-go="1"]');
      await page2.waitForTimeout(300);
      await page2.click('#setup-wifi-btn');
      await page2.waitForTimeout(300);
      const txt = await page2.textContent('#setup-wifi-state');
      check('without Fully it tells you what to do instead of pretending',
        /open wi-fi settings/i.test(txt), txt.slice(0, 70));
      await page2.close();
    }
  } finally {
    await browser.close();
    fs.existsSync(VARIANT) && fs.unlinkSync(VARIANT);
  }

  console.log(failures
    ? `\nRESULT: ${failures} check(s) failed`
    : '\nRESULT: a household can take this out of the box and end up on their own masjid');
  process.exitCode = failures ? 1 : 0;
})();
