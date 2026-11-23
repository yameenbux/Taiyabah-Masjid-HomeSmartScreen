# Tablet specification, for suppliers

A requirements sheet to send to an ODM or wholesaler, and the acceptance test to run on their sample
before placing an order.

This exists because a vague requirement gets agreed to and then quietly not met. Every line below is
written so that a sample either passes it or does not, and so that "yes we can do that" is checkable
against a device on a desk.

**Send §1–§3 to the supplier. Keep §4 for yourself.**

> **Context for anyone reading this cold.** The unit is a wall-mounted prayer-times display and masjid
> radio for a domestic kitchen. It is mains-powered, on continuously for years, and nobody touches it
> from one month to the next. That last point drives almost every requirement here: a tablet that needs
> a finger before it will do its job is not a candidate, however good the spec sheet is.

---

## 1. Non-negotiable

Reject the device if any of these is not met. They are ordered by how often they are the thing that
kills a candidate, not by importance.

| # | Requirement | Why it is non-negotiable |
| --- | --- | --- |
| 1.1 | **Powers on by itself when mains power is restored, with no button press.** | A power cut at 2am must not mean a silent Fajr. Many consumer tablets require a physical press to boot, which makes them unusable here. Ask this first: it is cheap to answer and disqualifies the most candidates. |
| 1.2 | Rated for **permanent mains connection**, running 24/7 for 3+ years | This is not a tablet that gets unplugged. |
| 1.3 | **Charge limiting** (cap at ~80–85%), **or** the ability to run with the battery bypassed or disconnected | A cell held at 100% and warm for two years swells, and a swollen battery lifts the screen off the chassis. This is the single most likely reason a unit comes back. |
| 1.4 | **IPS LCD. Not OLED or AMOLED.** | The layout is near-static for years. An OLED panel will ghost it in permanently. |
| 1.5 | **≥1920×1200**, 10.1"–11" | The screen is read across a kitchen. 1280×800 at this size is not sufficient and cannot be fixed later. |
| 1.6 | **≥400 cd/m²** brightness | Daylight on a kitchen wall. |
| 1.7 | **Genuine Android 13 or newer** — state `ro.build.version.release` **and** `ro.build.fingerprint` | Version strings on budget devices are sometimes inaccurate. The fingerprint is harder to fake and tells us what it really is. |
| 1.8 | **Device Owner provisioning works from the out-of-box setup wizard by QR code**, and auto-joins Wi-Fi from the QR payload | This is how units are configured in batches. Without it each device must be provisioned individually over USB, which is the difference between an afternoon and a week. |
| 1.9 | `adb shell dpm set-device-owner` works as a fallback | The escape hatch when 1.8 disappoints. Confirm it is not blocked. |
| 1.10 | **Working front camera**, usable during the setup wizard | QR provisioning reads the code with it. A camera-less device cannot be provisioned this way at all. |
| 1.11 | **≥4GB RAM, ≥64GB storage** | A browser engine running one page continuously for months, with live audio analysis. 2GB is not enough headroom. |
| 1.12 | **Two speakers, front- or down-firing.** State output power and **measured SPL at 1m in dB** | This device is a radio. The speaker is the product, not an accessory. Rear-firing speakers against a wall are disqualifying. |
| 1.13 | **3.5mm headphone jack** | Lets a household add their own speaker. Cheap to include, impossible to retrofit. |
| 1.14 | Dual-band Wi-Fi, **2.4GHz and 5GHz**, 802.11ac or better | Home networks, often congested on 2.4. |
| 1.15 | **Syncs time automatically over NTP at boot**, and recovers correct time after power loss | The entire product is times. A device that comes back from a power cut with the wrong clock shows the wrong prayer times. State whether a battery-backed RTC is fitted. |
| 1.16 | **Android System WebView updatable**, current Chromium | The app is a web app. State the WebView version as shipped. |
| 1.17 | **No mandatory Google account, SIM or sign-in at first boot** | Provisioning must complete without one. |
| 1.18 | **Vendor OTA updates can be disabled** | An unplanned 3am update that reboots out of kiosk mode, or changes the WebView, is a support call in someone's home. |
| 1.19 | Flat enough back to sit on a wall mount; **no protruding camera bump** | It is going on a wall bracket, not in a hand. |

### Desirable, not disqualifying

- Power-over-Ethernet, or a DC barrel input rather than USB-C (fewer things to pull out)
- A removable or replaceable battery (turns a swollen cell into a part swap, not a scrapped unit)
- Ambient light sensor (automatic night dimming)
- Matte or anti-glare panel
- Front bezel without a visible vendor logo

---

## 2. Documents required with the quote

Ask for these up front. A supplier who cannot produce them for the **exact model and variant** being
quoted is quoting something else.

- [ ] **CE and/or UKCA Declaration of Conformity naming the exact model number and variant.** A
      certificate listing other models does not cover yours.
- [ ] Radio test report (RED / EN 301 489, EN 300 328)
- [ ] **UN38.3 battery test report and MSDS** — required to ship the cells at all, and lithium cells are
      restricted on air freight
- [ ] RoHS and REACH statements
- [ ] **Google Mobile Services certification: yes or no.** If yes, the Play Protect certification listing.
      If no, say so plainly — it is workable but changes how the units are provisioned.
- [ ] Business licence, and whether you are the **factory or a trading company**

> **Ask explicitly:** does custom firmware, a custom boot logo, or an unlocked bootloader **void any of
> the certifications above?** Modifying system partitions or disabling Verified Boot can invalidate
> certification that has already been paid for. Get the answer in writing before ordering firmware work.

---

## 3. Questions to answer in writing

Numbered so they can be answered inline. Anything answered "no problem" without a figure is unanswered.

1. Does the device power on automatically when mains power is restored, with no button press? *(Yes/No
   — and if yes, is it default behaviour or a setting?)*
2. Exact panel: size, resolution, technology, brightness in cd/m², matte or glossy.
3. SoC model, RAM, storage.
4. `ro.build.version.release` and `ro.build.fingerprint` as shipped.
5. Is the device GMS certified?
6. Does QR-code Device Owner provisioning complete from the out-of-box setup wizard? Does it auto-join
   Wi-Fi from the QR payload?
7. Is `dpm set-device-owner` available over ADB?
8. Speaker count, placement, output power, and measured SPL at 1m.
9. Is there a charge-limit or charge-protection setting? Can the device run with the battery
   disconnected?
10. Is a battery-backed RTC fitted? Does the device NTP-sync at boot?
11. Can vendor OTA updates be disabled, and how?
12. MOQ, and unit price at 100 / 300 / 500 / 1000.
13. Boot logo and branding customisation: MOQ, one-off cost, and effect on certification.
14. Lead time from PO to shipment, for a plain order and for one with custom firmware.
15. Warranty term, DOA policy, and the return process.
16. **Spare parts: are replacement batteries and screens available separately, at what price, and for how
    many years?**
17. Packaging options, and whether a custom retail box is possible.
18. Payment terms, and whether the order is covered by Trade Assurance.

---

## 4. Sample acceptance test

**Buy samples from two or three suppliers before ordering from any of them.** Three samples is roughly
£150 and three weeks; the order they protect is five figures and non-returnable.

Run every test below on each sample. Record the result rather than an impression — "sounds fine" is not
a result.

| # | Test | Method | Pass |
| --- | --- | --- | --- |
| 4.1 | **Autoplay** | Install Fully Kiosk, enable Autoplay Audio, point at the live URL, read the console (see `home-player.md` → *Do this before you buy anything*) | `autoplay permitted by this browser` |
| 4.2 | **Power-cut recovery** | Pull the plug and restore it, **ten times**, touching nothing | Boots and resumes unaided every time |
| 4.3 | **Unattended adhan** | Reboot, touch nothing, wait for a prayer | `tuning in for the adhan`, and it is audible |
| 4.4 | **Unattended adhan, screen off** | Repeat 4.3 with the screen off on idle | Audio plays with the screen dark |
| 4.5 | **Provisioning route** | Factory reset, provision by QR from the setup wizard | Completes, and joins Wi-Fi from the QR |
| 4.6 | **Real resolution** | `adb shell wm size` and `adb shell wm density`, then read fine text from 3m | Framebuffer is ≥1920×1200 **and** small text is genuinely sharp. The shell reports the framebuffer, which does not prove the physical panel matches it, so the eye test is not optional |
| 4.7 | **Speaker at distance** | Play the adhan, stand 4m away with a tap running | Clearly intelligible |
| 4.8 | **Clock recovery** | Disconnect power for an hour, restore, then check the `device timezone …` line the app logs every boot (`home-player.md` → *Diagnostics*) | Correct time and prayer times unaided. A large correction on that line means the device's own clock came back wrong |
| 4.9 | **72-hour soak** | Leave running 72h untouched | No crash, no reload loop, no memory-pressure kill; audio still works at the end |
| 4.10 | **Charge behaviour** | Leave on mains 72h, check battery | Holds below ~90%, or charge limiting demonstrably active |

A device that fails **4.1** is scrap for this product at any price — no unit cost makes an adhan that
needs a finger acceptable. A device that fails **4.2** is the same. Those two are worth running first,
before anything else.

---

## Before committing to own-brand hardware

Placing a product on the GB market **under your own name or trademark** makes you the *manufacturer* in
law, not the distributor — with the conformity assessment, declaration of conformity, marking and
technical file that go with it. Branding the box, the mount and the software does not do this;
branding the device does. Decide which side of that line the product sits on **before** ordering, not
after, because it changes which of §2's documents must have your name on them rather than the
supplier's.
