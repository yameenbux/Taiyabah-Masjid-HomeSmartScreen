/* The volume control, and the audio graph it depends on.
 *
 * iOS makes HTMLMediaElement.volume read-only. Assigning to it is silently
 * ignored, so on an iPad the on-screen slider can only work by passing the
 * audio through a Web Audio GainNode. That is the whole reason the graph
 * exists — the meter is a bonus.
 *
 * But wiring the element into the graph has a cost that is easy to miss:
 * from that moment the element's audio goes THROUGH the graph instead of
 * straight to the speaker, so a context that is not running means no sound
 * at all. iOS only resumes a context from inside a real gesture, and the
 * adhan window opens on a timer, with nobody touching a tablet on a wall.
 * Attaching the graph on the way in would therefore silence the one thing
 * this screen exists to play.
 *
 * So this checks the two halves of that trade:
 *   1. where the context runs, the slider really does change the output —
 *      measured after the gain node, not merely read back off the property
 *   2. where the context will NOT resume, the audio still plays, the graph
 *      is left unattached, and the slider says so instead of sitting there
 *      looking operable
 *
 * (2) is the one that must never regress. A dead slider is a nuisance; a
 * silent adhan is the product failing at its only job.
 *
 *   node test-scripts/test-volume.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : '  — ' + detail}`);
  if (!ok) failures++;
}

/* A short tone, built here rather than fetched, so the suite needs no
   network and no fixture file. 440Hz at about -5dBFS: loud enough that the
   gain node has something to attenuate. */
function toneWav(seconds = 6, hz = 440, sr = 44100) {
  const n = seconds * sr;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * (i / sr)) * 18000), 44 + i * 2);
  }
  return buf;
}

const STATS = { streamstatus: 1, currentlisteners: 56 };

async function page(browser, { suspended } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/London',
  });
  const p = await ctx.newPage();
  const wav = toneWav();
  await p.route('**/stats**', r => r.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(STATS),
  }));
  await p.route('**/stream.mp3**', r => r.fulfill({
    status: 200, contentType: 'audio/wav',
    headers: { 'Access-Control-Allow-Origin': '*' }, body: wav,
  }));
  await p.addInitScript(([susp]) => {
    try { localStorage.setItem('taiyabah-sound-unlocked', '1'); } catch (e) {}
    if (susp) {
      /* An iPad nobody has touched: the context never leaves 'suspended'
         and resume() is refused outright, which is what iOS does outside a
         real gesture. */
      const Real = window.AudioContext;
      window.AudioContext = window.webkitAudioContext = class extends Real {
        get state() { return 'suspended'; }
        resume() { return Promise.reject(new DOMException('not allowed', 'NotAllowedError')); }
      };
    }
  }, [!!suspended]);
  await p.goto(FILE, { waitUntil: 'load' });
  return p;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  // ---- 1. where the context runs, the slider moves the actual output ----
  console.log('\nwith a context that runs:');
  const good = await page(browser);
  await good.waitForFunction(
    () => { const a = document.getElementById('audio-live'); return a && !a.paused && a.currentTime > 0.5; },
    null, { timeout: 25000 });

  const graph = await good.evaluate(() => ({
    gain: !!LIVE.gain, analyser: !!LIVE.analyser, works: liveVolumeWorks(),
    dead: document.getElementById('radio-vol').classList.contains('dead'),
  }));
  check('the gain node is in the audio path', graph.gain && graph.analyser);
  check('and the slider is presented as working', graph.works && !graph.dead);

  /* Measured after the gain node. Reading gain.value back would only prove
     the assignment happened, which is exactly what iOS does with
     element.volume while changing nothing. */
  const rmsAt = v => good.evaluate(async (val) => {
    const s = document.getElementById('radio-vol');
    s.value = String(val);
    s.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 600));
    const buf = new Uint8Array(LIVE.analyser.fftSize);
    let peak = 0;
    for (let n = 0; n < 60; n++) {
      LIVE.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
      peak = Math.max(peak, Math.sqrt(sum / buf.length));
    }
    return peak;
  }, v);

  const full = await rmsAt(100);
  const half = await rmsAt(45);
  const zero = await rmsAt(0);
  check('full volume produces a signal', full > 0.05, `rms=${full.toFixed(4)}`);
  check('lowering the slider lowers the output', half < full * 0.75 && half > 0.005,
    `rms=${half.toFixed(4)} vs ${full.toFixed(4)} at full`);
  check('zero is actually silent', zero === 0, `rms=${zero.toFixed(4)}`);
  await good.context().close();

  // ---- 2. where the context will not resume, sound still comes out ----
  console.log('\nwith a context that will not resume (an untouched iPad):');
  const stuck = await page(browser, { suspended: true });
  await stuck.waitForTimeout(6000);
  const r = await stuck.evaluate(() => {
    const a = document.getElementById('audio-live');
    const v = document.getElementById('radio-vol');
    return {
      playing: !a.paused && a.currentTime > 0.3, t: +a.currentTime.toFixed(2),
      state: LIVE.state, graph: !!LIVE.analyser, gain: !!LIVE.gain,
      dead: v.classList.contains('dead'), disabled: v.disabled, title: v.title,
    };
  });
  check('the stream still plays', r.playing, `state=${r.state} currentTime=${r.t}`);
  check('the graph is NOT attached — attaching it would mute the speaker',
    !r.graph && !r.gain, `analyser=${r.graph} gain=${r.gain}`);
  check('the slider admits it cannot work', r.dead && r.disabled,
    `dead=${r.dead} disabled=${r.disabled}`);
  check('and points at the hardware buttons', /volume buttons/i.test(r.title),
    JSON.stringify(r.title));
  await stuck.context().close();

  await browser.close();
  console.log(failures
    ? `\nRESULT: ${failures} check(s) failed`
    : '\nRESULT: the slider sets the real level where it can, and says so where it cannot');
  process.exitCode = failures ? 1 : 0;
})();
