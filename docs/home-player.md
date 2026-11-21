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

## Setting a device up, out of the box

A household opens the box, plugs it in, and the screen runs setup by itself:
**welcome → connect to Wi-Fi → which masjid do you attend → done.** It then
shows that masjid's times and plays their adhan live at every salah.

The Wi-Fi step cannot be done in the page — no browser can scan for networks or
take a password, and none should be able to. What Fully Kiosk provides is
`fully.openWifiSettings()`, so the screen hands over to **Android's own Wi-Fi
picker**: a screen the household has seen before, which handles WPA3 and
captive portals properly and which we would only have reimplemented badly. The
page then watches `fully.isWifiConnected()` and moves on by itself, which is
the part that would otherwise leave someone stranded on a settings screen not
knowing what to press.

> **This answers the wifi wrinkle above.** You no longer have to choose between
> whitelisting a settings screen and handing out the PIN — setup opens the
> picker for them, once, as a step in the flow. Fully's **JavaScript Interface**
> must be enabled (PLUS) for this. Fully's own docs warn that the interface
> lets any loaded page read local files and change device settings, so pair it
> with Fully's **URL whitelist** restricted to this site. On a locked kiosk
> showing one page that is a reasonable trade; leaving it open to the whole web
> is not.

Setup appears only on a real unit (Fully present, nothing chosen yet) or when
`?setup` is in the URL. A plain web visitor and the masjid's own wall screens
never see it — they get the default masjid and behave exactly as before.

A household that changes masjid later doesn't need the URL: **Other masjids →
Change my masjid** reopens setup at the picker.

## One screen, many masjids

The screen is a neutral shell. The chosen masjid's name, times, adhan, jamā'ah,
contact details and donation QR are all theirs; the sky, the type and the
layout are the same for everyone. A masjid that supplied no logo gets its name
set as a wordmark, so joining needs no artwork.

Adding a masjid is adding a directory — see
[`adding-a-masjid.md`](adding-a-masjid.md), which also covers the part that
isn't code: there is no API for jamā'ah times, so every masjid on the list is a
timetable somebody collects and re-collects each year.

Separately from whose screen it is, **the dial still reaches everyone else.**
Picking your masjid sets your times; the **Other masjids** button lets you
listen to any of the others without your times changing. Three behaviours exist
to protect Fajr, and all three follow *your* masjid rather than a fixed one:

| Behaviour | Why |
| --- | --- |
| Auto-tune only works on your own masjid | The prayer windows are built from your masjid's timetable, so they mean nothing on someone else's stream. |
| The recorded adhan still plays when tuned away | Another masjid's programme is **not** your adhan. Suppressing on it would hand the household someone else's talk at Fajr with the radio apparently working perfectly. |
| The dial returns home overnight | The nightly reload comes back on your masjid, so tuning away and forgetting does not cost months of live Fajr. |

> **Ask before adding anyone's stream.** Every screen that tunes to a masjid
> consumes one of *their* listener slots and *their* bandwidth. A few hundred
> units pointed at their mount could knock their own congregation off.

`test-setup.js` and `test-tuner.js` cover all of this, including the assertion
the whole product rests on — that choosing a masjid really does move the times,
not just the name over them.

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
