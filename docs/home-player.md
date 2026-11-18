# Putting the screen in people's homes

This is the plan for replacing the FM transmitter: a small always-on screen in a household's kitchen
or hallway that shows the prayer times and carries the masjid's own muadhin live.

**Every home gets a unit the masjid buys, locks down and hands over working.** There is deliberately
no bring-your-own-device option — see [why that choice is load-bearing](#why-owning-every-unit-matters)
below, because it decides more than it looks like it does.

> **The other two device docs do not apply here.** [`kiosk-windows.md`](kiosk-windows.md) and
> [`android-tv.md`](android-tv.md) are for the masjid's own wall displays, and every assumption in them
> is false in a home: you don't own the building, you can't reach the network, there are hundreds of
> devices rather than three, and the person standing in front of it is a member of the congregation,
> not a technician. Read those for the masjid. Read this for homes.

## Do this before you buy anything

Everything below rests on one question: **will the adhan sound when nobody has touched the device?**
A radio that goes silent after a power cut is not a radio.

Browsers refuse to play audio until the page has been interacted with. Fully Kiosk has an
**Autoplay Audio** setting, but its own documentation says it *"autoplays embedded HTML5 audio (this
works only with websites having a static `<audio>` tag for now)"* — and this app starts playback from
JavaScript, not a static tag. Whether that setting lifts the restriction anyway (it may map to Android
WebView's `setMediaPlaybackRequiresUserGesture(false)`, which would cover everything) is undocumented.

You do not have to guess. **The app tells you.** It probes autoplay at boot and logs the result:

```
[taiyabah] autoplay permitted by this browser — sound enabled with no interaction     ← good
[taiyabah] autoplay probe refused: <reason>                                           ← needs the wrapper
```

### The test, on one device, before ordering the rest

1. Buy **one** tablet. Install Fully Kiosk, enable **Autoplay Audio**, point it at the live URL.
2. Read the console (Fully Cloud's remote view, or `adb logcat | grep taiyabah` on the same network).
   Look for which of the two lines above appears. That is your answer in thirty seconds.
3. Then prove it end to end: reboot, **touch nothing**, and wait for Zuhr or Asr. You should see
   `[taiyabah] tuning in for the adhan` and hear it.
4. Repeat step 3 **with the screen off**, because that is how it will spend every night and Fajr
   depends on it.

### Why owning every unit matters

If the probe is refused, the fix is the Android wrapper already in this repo: a WebView you control can
call `setMediaPlaybackRequiresUserGesture(false)` directly, which is guaranteed rather than hopeful. It
means distributing an APK instead of a URL, and rebuilding it when the app shell changes.

**That fallback only exists because the masjid owns the hardware.** On someone's own phone you cannot
install a privileged wrapper, cannot pick the browser, and on an iPhone or iPad cannot lift the gesture
requirement at all — iOS provides no mechanism, so the adhan would simply never sound unattended. A
bring-your-own-device tier would have left the core promise of the product unfixable on an unknown
fraction of devices. Supplying the unit turns the one genuine technical unknown here into a problem
with two solutions instead of none.

It has a second benefit worth planning around: **standardise on a single tablet model.** You then test
autoplay, speaker volume, screen-off audio and battery behaviour exactly once, and every support call
is about a device you have in front of you.

---

## The unit

### Hardware

| Requirement | Why it matters |
| --- | --- |
| 10–11", 1920×1200 Android tablet | Readable across a kitchen. A tablet bundles screen, speaker, wifi and touch for less than a Pi plus screen plus case plus PSU. |
| **LCD / IPS — never OLED** | The layout is near-static for years. An OLED panel will ghost it in permanently. |
| **Android 9 or newer** | QR provisioning then auto-joins wifi and needs no internet. On Android 7–8 it needs a connection and won't auto-join. |
| A front- or down-firing speaker | This is a radio. The speaker is the product, not an accessory. |
| Mains powered, permanently | See the warning below. |

Roughly **£120–200** for a Lenovo Tab M11 class device, though listings vary enough that you should
price it the week you buy. At any serious unit count this is the dominant cost of the whole project,
so it is worth getting quotes rather than buying at retail.

> **The battery is the part that will fail.** A tablet held at 100% charge, warm, for two years will
> swell, and a swollen battery lifts the screen off the chassis. Prefer a device with charge limiting,
> or plan to replace batteries, or budget for attrition. This is the most likely reason a unit comes
> back, and it is not a software problem.
>
> This cuts against buying refurbished to save money: a refurb unit is much cheaper per screen, and
> cosmetic grade genuinely doesn't matter on a wall, but an already-aged battery held at full charge
> is the one component you least want second-hand. If you go refurb, prioritise battery health over
> appearance and expect a higher return rate.

### Fully Kiosk settings that actually matter

Buy the **volume licence — one key covers 10+ devices.** Do not buy individual licences per unit.

| Setting | Value | Why |
| --- | --- | --- |
| Autoplay Audio | On | The whole product. See the test above. |
| Kiosk Mode, with PIN exit gesture | On | The lockdown. Keep the PIN at the masjid. |
| Lock Task Mode *(Device Owner)* | On | Proper kiosk: kills the home and recents buttons and the status bar. Far stronger than kiosk mode alone. |
| Autostart on boot | On | Comes back by itself after a power cut. |
| Auto restart Fully after crashes | On | Comes back by itself after a crash. |
| Switch screen off on idle | On | Overnight dimming — see the schedule warning below. |
| Mute Audio / Disable Volume Buttons | **Off** | Leave the household their volume. Muting the device defeats the purpose. |
| Disable ADB *(Device Owner)* | Off until deployed | You want ADB during the autoplay test. Turn it off for units going out. |
| Daily System Restart *(Device Owner)* | ~03:00, **only once the autoplay test passes** | See below. |

> **Do not set a daily restart until autoplay is confirmed working.** If the device needs a tap to
> enable sound, a nightly reboot converts a one-off annoyance into a device that is silent *every*
> morning. The setting is good hygiene on a working unit and actively harmful on a broken one.

### Overnight scheduling: don't

The obvious move is a hibernate schedule — screen off at 23:00, on at 06:00. **It would silence Fajr
for a large part of the year.** Measured from the timetable in this repo:

| | Earliest | Latest |
| --- | --- | --- |
| Fajr begins | **02:33** (15 Jun 2026) | 06:36 (31 Dec 2027) |
| Isha jamā'ah | 18:30 (1 Jan 2026) | **23:00** (8 Jul 2027) |

The stream opens 3 minutes before the Fajr adhan and closes 25 minutes after Isha jamā'ah, so on the
shortest night of the year there are **only 185 minutes** when nothing is scheduled at all.

So use **Switch screen off on idle** instead of a clock schedule: the app keeps running and the audio
keeps playing with the screen dark. This is step 4 of the test above, and it is not optional.

### Provisioning without configuring every tablet by hand

Fully supports **QR Code provisioning** (Android 7+, factory-reset device required). You generate the
code once in Fully's web configurator; it carries the APK URL and your settings. A reset tablet scans
it and provisions itself as Device Owner with your configuration already applied. On **Android 9+ it
auto-joins wifi and needs no internet connection** to do it, which is what makes this tractable at
scale. **ADB (manual)** is the fallback when you can't factory reset a device.

Do them in batches at the masjid. The household should receive a unit that needs a plug and nothing else.

> **The wifi wrinkle, which you will hit on unit one.** You provision on the masjid's wifi; the device
> then has to join the household's. But you've just locked it down so they can't reach Settings.
> Decide this deliberately: either whitelist the wifi settings screen in kiosk mode, or hand over the
> PIN for that one purpose, or set each unit up with the household's password already on it. Verify
> whichever you pick on a real device — this is the single most common reason a locked unit arrives
> dead.

### Managing them once they're out there

Across hundreds of private home networks, REST and MQTT are useless to you — they need a route into
each house. **Fully Cloud** is the only realistic remote-management path, and it is a per-device
subscription, so price it as part of the per-home cost rather than a footnote.

What reaches every home with nobody doing anything: **prayer times, layout, audio timing and bug
fixes.** The service worker is network-first for the page and the app reloads itself just after 2am, so
a change pushed to `main` is on every screen within 24 hours. That is the single best property of this
whole design and it is worth protecting.

What needs Fully Cloud or a visit: Fully's own settings, the licence, Android updates. What needs a new
APK: only the wrapper route, if the autoplay test sends you there.

### Support

Assume a failure rate and budget spares. Give each household a printed card: what it is, the donation
link, and *"if the screen is blank, unplug it for ten seconds."* That one sentence will resolve most
calls. Keep the PIN with the masjid, not on the card.

Decide up front what happens when a household moves, stops wanting it, or the battery swells — units
coming back is a normal part of running a fleet, not an exception.

---

## Listening to other masjids

The FM receiver this replaces could reach every transmitter in Bolton, and some people will rightly
count that as the better radio. The screen has a dial for the same reason: a **Other masjids** button
beside the listen control opens a list, and choosing one tunes to it.

**With one masjid configured the dial does not appear at all**, so nothing changes until you add
someone. The list is `data/stations.json`; Taiyabah is not in it, because it comes from `stream.json`
and should exist in exactly one place. The build refuses duplicate ids, duplicate URLs, a station
reusing the reserved `taiyabah` id, and any non-HTTPS stream (the page is served over HTTPS, so a
plain-HTTP mount is blocked as mixed content and fails silently).

> **Ask the masjid first. This spends their money, not ours.** Every screen that tunes to another
> masjid consumes one of *their* listener slots and *their* bandwidth. A few hundred of our units
> pointed at their mount could exhaust their plan and knock their own congregation off the stream.
> Hotlinking a publicly reachable URL is technically easy and is not the question. Who appears on
> that list is also a decision for the masjid committee rather than a technical one.

**The screen is always Taiyabah's; only the sound is chosen.** The times, the countdown, the date,
the Hijri date, the Jumu'ah line and the branding never change, whatever is playing. The only things
that follow the dial are the ones describing the sound itself: the dial button, the listen pill while
live, and the lock-screen media metadata. `test-tuner.js` snapshots the whole face of the screen
either side of a tune and fails if a single character of it moves, so this is enforced rather than
remembered. No other masjid's timetable is held, needed, or maintained.

Three further behaviours are deliberate, and all three exist to protect Fajr:

| Behaviour | Why |
| --- | --- |
| Auto-tune only works on Taiyabah | The prayer windows are built from Taiyabah's timetable, so they mean nothing on another masjid's stream. Someone listening elsewhere is never interrupted or dragged back. |
| The recorded adhan still plays when tuned away | Live playback normally suppresses the recording, because the real muadhin is about to come through. Another masjid's programme is **not** our adhan, so the recording is not suppressed — otherwise the household would get someone else's talk at Fajr with the radio apparently working perfectly. |
| The dial returns to Taiyabah overnight | The page reloads itself just after 2am and comes back on the home masjid. A household that tunes away and forgets would otherwise have Fajr arrive as a recording for months without ever connecting the two. |

The picker opens with focus on the station currently selected rather than on **Close**, so a TV remote
lands where the choice is. `test-tuner.js` covers all of this, including a negative control that
auto-tune still fires on the home masjid — without it, the "doesn't hijack" check would also pass on a
screen where auto-tune was simply broken.

---

## Diagnostics

Over Fully Cloud, or `adb logcat | grep taiyabah` on the same network:

| Line | Meaning |
| --- | --- |
| `autoplay permitted by this browser` | Sound works untouched. This is the one you want. |
| `autoplay probe refused: …` | The adhan will not sound unattended. Go back to the test section. |
| `tuning in for the adhan` | Auto-tune opened the stream. |
| `jamaa'ah over — leaving the stream` | Auto-tune closed it. Normal. |
| `adhan is coming through the live stream — recording suppressed` | Correct behaviour: the masjid's own muadhin, not the bundled recording. |
| `live stream <reason> — reconnecting in Ns` | Stream dropped; backoff is working. |
| `device timezone <zone>; showing Europe/London` | Printed every boot. Times are corrected regardless, but a large correction means that device's clock is wrong. |
| `timers were suspended for ~Ns — catching up` | The device slept. Revisit the idle settings. |

## What limits how many homes you can serve

Not the tablets. The stream — see [`stream-capacity.md`](stream-capacity.md). Settle that before
committing to a unit count.
