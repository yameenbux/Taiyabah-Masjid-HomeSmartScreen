const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '../index.html');

// A Fire Stick's timezone is whatever it was set to at first boot, and a
// reset or a factory default can leave it anywhere. Every screen must still
// show Bolton's times. These stand in for a misconfigured stick.
const DEVICE_ZONES = [
  'Europe/London',      // correct — the control
  'UTC',                // the classic factory default; an hour out in summer
  'America/New_York',
  'Asia/Karachi',
  'Australia/Sydney',   // far enough to land on a different calendar day
];

(async () => {
  const browser = await chromium.launch();
  const results = [];

  for (const zone of DEVICE_ZONES) {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, timezoneId: zone });
    await page.goto(FILE);
    await page.waitForTimeout(700);
    const seen = await page.evaluate(() => ({
      deviceZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      clock: document.getElementById('clock').textContent.trim(),
      dateline: document.getElementById('dateline').textContent.trim(),
      next: document.getElementById('hero-name').textContent.trim(),
      jamaah: document.getElementById('hero-sub').textContent.trim(),
      table: [...document.querySelectorAll('#rows .prow')]
        .map(r => [...r.querySelectorAll('span')].map(s => s.textContent.trim()).join(' ')).join(' | '),
    }));
    results.push({ zone, ...seen });
    await page.close();
  }

  const control = results[0];
  console.log(`Control — device on ${control.deviceZone}`);
  console.log(`  clock ${control.clock} | ${control.dateline}`);
  console.log(`  next: ${control.next} — ${control.jamaah}\n`);

  let failures = 0;
  for (const r of results.slice(1)) {
    // The device really is on the zone we asked for, or the test proves nothing.
    const overrideTook = r.deviceZone === r.zone;
    // Clock is HH:MM, so a minute boundary between page loads is a legitimate
    // difference; the prayer data must be identical regardless.
    const sameData = r.dateline === control.dateline && r.next === control.next
                  && r.jamaah === control.jamaah && r.table === control.table;
    const clockNote = r.clock === control.clock ? 'same' : `${r.clock} vs ${control.clock} (minute boundary?)`;
    const ok = overrideTook && sameData;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  device on ${r.zone.padEnd(18)} override applied: ${overrideTook} | prayer data identical: ${sameData} | clock: ${clockNote}`);
    if (!sameData) {
      console.log(`        next:     ${r.next} — ${r.jamaah}`);
      console.log(`        dateline: ${r.dateline}`);
    }
  }

  console.log(`\nRESULT: ${failures === 0
    ? 'every simulated device shows Bolton times'
    : failures + ' device timezone(s) showed different times — the masjid clock is not being applied'}`);

  await browser.close();
  process.exitCode = failures === 0 ? 0 : 1;
})();
