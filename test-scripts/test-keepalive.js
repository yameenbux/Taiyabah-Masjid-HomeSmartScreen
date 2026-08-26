const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '../index.html');
const ka = () => document.getElementById('audio-keepalive');

(async () => {
  const browser = await chromium.launch();

  // 1. Before the pill is tapped there should be no audio running at all —
  //    the keep-alive is not a way to sneak around the autoplay gesture.
  {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, timezoneId: 'Europe/London' });
    await page.goto(FILE);
    await page.waitForTimeout(600);
    console.log('1. Before unlock — keep-alive playing:',
      await page.evaluate(() => !document.getElementById('audio-keepalive').paused),
      '(expect false) | pill:', (await page.textContent('#sound-pill-label')).trim());
    await page.close();
  }

  // 2. One tap starts it, looping, and the clock actually advances (a
  //    "playing" element whose currentTime is stuck is not keeping anything
  //    awake).
  {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, timezoneId: 'Europe/London' });
    await page.goto(FILE);
    await page.waitForTimeout(400);
    await page.click('#sound-pill');
    await page.waitForTimeout(3000);
    const state = await page.evaluate(() => {
      const el = document.getElementById('audio-keepalive');
      return { playing: !el.paused, loop: el.loop, muted: el.muted, t: el.currentTime };
    });
    console.log('2. After tap — playing:', state.playing, '| loop:', state.loop,
      '| muted:', state.muted, '(must be false — a muted element is not active media)',
      '| currentTime advanced:', state.t > 0);
    console.log('   pill:', (await page.textContent('#sound-pill-label')).trim());
    await page.close();
  }

  // 3. Something else grabs the audio (a phone call, another app). The loop
  //    has to come back on its own — nobody is standing at the tablet.
  {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, timezoneId: 'Europe/London' });
    await page.goto(FILE);
    await page.waitForTimeout(400);
    await page.click('#sound-pill');
    await page.waitForTimeout(800);
    await page.evaluate(() => document.getElementById('audio-keepalive').pause());
    await page.waitForTimeout(1800);
    console.log('3. After an external pause — recovered:',
      await page.evaluate(() => !document.getElementById('audio-keepalive').paused),
      '| pill:', (await page.textContent('#sound-pill-label')).trim(), '(should still read green)');
    await page.close();
  }

  // 4. The case this is really for: sound "unlocked" from a previous session
  //    but audio output actually refused. The pill must NOT sit there green
  //    over a display that can no longer sound the Adhan.
  {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, timezoneId: 'Europe/London' });
    await page.addInitScript(() => { try { localStorage.setItem('taiyabah-sound-unlocked','1'); } catch(e){} });
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function(){ return Promise.reject(new DOMException('NotAllowedError')); };
    });
    await page.goto(FILE);
    await page.waitForTimeout(4500);
    console.log('4. Audio output blocked — pill:', (await page.textContent('#sound-pill-label')).trim(),
      '(expect "Sound paused · tap to resume")');
    console.log('   pill still on screen:', await page.getAttribute('#sound-pill', 'hidden') === null);
    await page.screenshot({ path: 'screenshot-keepalive-blocked.png' });
    await page.close();
  }

  // 5. The OS will show a media notification for the loop, so it needs a
  //    name rather than an anonymous tile someone taps "stop" on.
  {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, timezoneId: 'Europe/London' });
    await page.goto(FILE);
    await page.waitForTimeout(400);
    await page.click('#sound-pill');
    await page.waitForTimeout(600);
    const meta = await page.evaluate(() => {
      if (!('mediaSession' in navigator) || !navigator.mediaSession.metadata) return null;
      const m = navigator.mediaSession.metadata;
      return { title: m.title, artist: m.artist };
    });
    console.log('5. Media session metadata:', meta ? `${meta.title} — ${meta.artist}` : 'NOT SET');
    await page.close();
  }

  await browser.close();
})();
