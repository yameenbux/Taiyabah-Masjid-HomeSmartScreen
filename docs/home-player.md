# Putting the screen in people's homes

This is the plan for replacing the FM transmitter: a small always-on screen in a household's kitchen
or hallway that shows the prayer times and carries the masjid's own muadhin live.

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
[taiyabah] autoplay probe refused: <reason>                                           ← fatal for homes
```

### The test, on one device, before ordering the rest

1. Buy **one** tablet. Install Fully Kiosk, enable **Autoplay Audio**, point it at the live URL.
2. Read the console (Fully Cloud's remote view, or `adb logcat | grep taiyabah` on the same network).
   Look for which of the two lines above appears. That is your answer in thirty seconds.
3. Then prove it end to end: reboot, **touch nothing**, and wait for Zuhr or Asr. You should see
   `[taiyabah] tuning in for the adhan` and hear it.

**If the probe is refused**, the supplied-unit tier needs the Android wrapper already in this repo
instead of a plain URL — a WebView you control can call `setMediaPlaybackRequiresUserGesture(false)`
directly, which is guaranteed rather than hopeful. That means distributing an APK and rebuilding it when
the shell changes. It is a known, solvable problem, but it changes the rollout, so find out first.

---

## Tier 1 — the supplied unit

A tablet the masjid buys, locks down, and hands over working.

### Hardware

| Requirement | Why it matters |
| --- | --- |
| 10–11", 1920×1200 Android tablet | Readable across a kitchen. A tablet bundles screen, speaker, wifi and touch for less than a Pi plus screen plus case plus PSU. |
| **LCD / IPS — never OLED** | The layout is near-static for years. An OLED panel will ghost it in permanently. |
| **Android 9 or newer** | QR provisioning then auto-joins wifi and needs no internet. On Android 7–8 it needs a connection and won't auto-join. |
| A front- or down-firing speaker | This is a radio. The speaker is the product, not an accessory. |
| Mains powered, permanently | See the warning below. |

Roughly **£120–200** for a Lenovo Tab M11 class device, though listings vary enough that you should
price it the week you buy.

> **The battery is the part that will fail.** A tablet held at 100% charge, warm, for two years will
> swell, and a swollen battery lifts the screen off the chassis. Prefer a device with charge limiting,
> or plan to replace batteries, or budget for attrition. This is the most likely reason a unit comes
> back, and it is not a software problem.

### Fully Kiosk settings that actually matter

Buy the **volume licence — one key covers 10+ devices.** Do not buy 200 individual licences.

| Setting | Value | Why |
| --- | --- | --- |
| Autoplay Audio | On | The whole product. See the test above. |
| Kiosk Mode, with PIN exit gesture | On | The lockdown you asked for. |
| Lock Task Mode *(Device Owner)* | On | Proper kiosk: kills the home and recents buttons and the status bar. Far stronger than kiosk mode alone. |
| Autostart on boot | On | Comes back by itself after a power cut. |
| Auto restart Fully after crashes | On | Comes back by itself after a crash. |
| Switch screen off on idle | On | Overnight dimming — see the schedule warning below. |
| Mute Audio / Disable Volume Buttons | **Off** | Leave the household their volume. Muting the device defeats the purpose. |
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
keeps playing with the screen dark. Add this to your one-device test — confirm the adhan still sounds
with the screen off, because that is how it will spend every night.

### Provisioning without configuring 200 tablets by hand

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

At 200 homes on 200 private networks, REST and MQTT are useless to you — they need a route into each
house. **Fully Cloud** is the only realistic remote-management path, and it is a per-device
subscription, so price it as part of the per-home cost rather than a footnote.

What reaches every home with nobody doing anything: **prayer times, layout, audio timing and bug
fixes.** The service worker is network-first for the page and the app reloads itself just after 2am, so
a change pushed to `main` is on all 200 screens within 24 hours. That is the single best property of
this whole design and it is worth protecting.

What needs Fully Cloud or a visit: Fully's own settings, the licence, Android updates. What needs a new
APK: only the wrapper route, if the autoplay test sends you there.

### Support, at this scale

Assume a failure rate and budget spares. Give each household a printed card: what it is, the donation
link, and *"if the screen is blank, unplug it for ten seconds."* That one sentence will resolve most
calls. Keep the PIN with the masjid, not on the card.

---

## Tier 2 — bring your own device

Free, no hardware cost, and you should be honest with yourself about what it is: **a way to see the
times, not a reliable radio.** You cannot lock down a device you don't own.

**Android.** Chrome → **Install app**. The manifest sets `display: fullscreen`, so it opens with no
address bar. Android's own **App pinning** (Settings → Security → App pinning) gives a light lockdown
the household can undo — fine for a device they chose to dedicate. Autoplay behaviour in Chrome is not
the same as in Fully, so a tap may be needed after each launch.

**iPhone / iPad.** Add to Home Screen works, and the times, countdown and layout are all correct. But
**iOS provides no way to lift the audio gesture requirement**, so the adhan will not sound unattended,
and the screen will sleep. Guided Access pins the app but changes none of that. Present the iOS route
as "check the times", and don't let anyone believe it replaces their radio. Confirm on a real iPad
before you write the instructions — the gesture policy is certain, the screen-sleep behaviour is worth
seeing for yourself.

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
