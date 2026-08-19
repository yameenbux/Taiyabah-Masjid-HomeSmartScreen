# Taiyabah Masjid — Home Smart Screen

A prayer-times dashboard for people's own tablets and TVs at home — kept
"Today's Salah" on screen, with a countdown to the next Jamā'ah, and
(optionally) the Adhan and Iqamah sounding automatically at the right
times. Same colours, fonts, logo and geometric motif as the
[website](https://yameenbux.github.io/Taiyabah-Mosque-Website-Rebrand/),
[app](https://yameenbux.github.io/Taiyabah-Mosque-App/) and
[in-mosque screens](https://github.com/yameenbux/Taiyabah-Mosque-Interactive-Screens),
pulled directly from those repos rather than reinterpreted.

## What's here

```
index.html               The app. Single page, no build step.
manifest.webmanifest      Home-screen / Smart TV install metadata.
sw.js                     Service worker — offline shell caching.
logo-cream.png, logo-dark.png, icon-*.png, apple-touch-icon.png
                           Masjid branding, copied from the app repo.
audio/
  adhan-full.mp3           Full Adhan — see Audio sources below.
  iqamah-short-PLACEHOLDER.mp3   A synthesised two-tone chime, NOT a
                           real Iqamah recording — see below.
data/
  timetable-2026.json       Copied from the app repo's data pipeline —
                           the masjid's own published times, not
                           calculated. Regenerate the same way the app
                           does (`app/data/parse_timetable.py`) each year.
```

## Audio — Adhan & Iqamah

The brief: 15 minutes before each Jamā'ah, play the **full Adhan**
automatically; at Jamā'ah time itself, play a **short Iqamah**. Both are
wired up and working (`buildTriggersForDay` / `checkAudioTriggers` in
`index.html`) — on Fridays the Zuhr slot triggers on the first Jumu'ah
only, matching the on-screen table.

**Full Adhan — done.** `audio/adhan-full.mp3` is "Athan Makkah" from the
[abodehq/Athan-MP3](https://github.com/abodehq/Athan-MP3) collection —
a real ~3.4 minute Adhan recording. That repo carries no formal licence
file, only a note that the collection is free to download, so treat the
provenance as unverified rather than cleared for commercial use; it's
fine for a community masjid's own non-commercial home screen, but worth
knowing if this ever gets redistributed more widely.

**Short Iqamah — not done, needs you.** I could not get you a real
Iqamah recording from Masjid al-Haram. The best match I found was an
Internet Archive item titled **"اقامة الصلاة في الحرم المكي" — the
Iqamah in Masjid al-Haram** —

**https://archive.org/details/iqamah_athan**

— but my sandboxed environment can only reach GitHub and a couple of
package registries directly; Internet Archive is unreachable from here,
so I couldn't download it for you. `audio/iqamah-short-PLACEHOLDER.mp3`
is a synthesised two-tone chime standing in for it — it works
functionally (it fires at the right second) but it is not the sound you
asked for. To finish this:

1. Open the link above in your own browser, download the `iqamah.mp3`
   track (there's also a fuller `athan_all` / `athan_fajr` pair on the
   same page if you'd rather use those instead of the abodehq one above).
2. Replace `audio/iqamah-short-PLACEHOLDER.mp3` with it — keep the
   filename, or update the one `src="audio/..."` line for
   `#audio-iqamah` in `index.html` if you rename it.
3. Send it back to me (or just commit it to this repo) and I'll fold it
   in properly, trim silence, and re-test the trigger timing against it.

## Browser autoplay — the one real limitation

Browsers block audio from playing automatically until a person has
interacted with the page at least once. The gold "Enable Adhan &
Iqamah sound" pill in the header handles that — one tap, and it's
remembered (`localStorage`) so it won't ask again on that device. Two
things make this more reliable in practice:

- **Install it** (Add to Home Screen on a tablet, or pin it on a Smart
  TV browser) rather than leaving it as a loose browser tab — installed
  PWAs are given much more relaxed autoplay permissions by Chrome and
  most TV browsers.
- **Serve it over HTTPS**, e.g. GitHub Pages the same way the other
  three repos are deployed. Service workers (and therefore the offline
  cache and reliable install prompt) don't run over a plain `file://`
  path or unencrypted HTTP.

## Deploying

Same pattern as the other three repos — GitHub Pages, root of `main`:

```
Settings → Pages → Deploy from a branch → main / (root)
```

## Smart TV / Alexa Show compatibility

Deliberately not tackled yet, at your instruction — this first pass is
the working dashboard. When you're ready to come back to it: Fire TV's
Silk browser and most Android TV/Google TV/Tizen browsers can already
open this as a plain web page or installed PWA today (worth testing as
a "day one" checkpoint before building anything bespoke). An Alexa
Show ("Echo Show") smart-home screen is a different animal — those
run Alexa Skills / APL documents, not arbitrary web pages, so showing
this there would mean building a small Alexa Presentation Language
skill that fetches `data/timetable-2026.json` rather than embedding
this HTML directly. Flagging that distinction now so it doesn't come
as a surprise at that stage.

## Credits

Built for Bolton Central Islamic Society. Prayer times, the Taiyabah
Masjid name, and the masjid's logo belong to the charity. Adhan
recording credited to the abodehq/Athan-MP3 collection — see the audio
note above on its licence.
