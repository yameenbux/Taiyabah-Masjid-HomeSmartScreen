# Bolton masjids: what's actually out there

Research for filling `data/masjids/`. Gathered from public sources on
2026-11-18. **Nothing here has been confirmed by any masjid**, and none of it
is in the build.

The headline: of the 27 masjids the Bolton Council of Mosques represents, **one
publishes a machine-readable full-year 2026 timetable.** The rest publish a
daily table, a scanned image, or nothing. Any plan that assumes nine timetables
can be collected from the web is wrong.

## The transmitters are not FM

Worth correcting early, because it changes what "frequency" means here. Bolton
masjid transmitters run on **UHF business radio around 454 MHz**, not FM
broadcast. The receivers people have in their kitchens are repurposed PMR
handhelds. That explains the short range, the per-masjid signal, and why the
sets are sold preset to "channels" rather than tuned to a dial.

| Masjid | Frequency | Source |
| --- | --- | --- |
| Zakariyya Jaam'e | **454.275** | Their own 2026 calendar PDF — current |
| Ashrafia | **454.250** | Their own 2026 timetable PDF — current |
| Taiyabah | 454.100 | UK Scanning Directory, submitted Jan 2014 |
| Daubhill Muslim Society | 454.025 | Same, Jun 2014 |
| Makki Muslim Society | 454.40625 | Same, Jun 2014 |
| Noorul Islam, Halliwell | 454.79375, and 456.950/462.450 | Same, Jan 2014 |
| Madina, Chorley New Rd | 455.475 | Same, Mar 2016 |

The first two came from the masjids themselves this year and can be trusted.
The rest are user-submitted scanner logs from 2014–2016 — a decade old, and
masjids change frequencies. Treat them as a conversation-starter ("is it still
454.100?"), not as data.

**These are a recognition aid, not a feature.** The product streams over the
internet; it does not receive 454 MHz. Printing "454.275" next to Zakariyya in
the picker is worth doing because it is how people already know which masjid
they are listening to — it is the number on the set in their kitchen.

## Timetables: the actual availability

| Masjid | What they publish | Usable? |
| --- | --- | --- |
| **Ashrafia** | Full-year 2026 PDF **with a text layer** | **Yes** — 361 of 365 days extracted cleanly, see below |
| **Zakariyya** | Full-year 2026 PDF, but the tables are **images** | Only by OCR, which is the wrong way to get prayer times. Ask them for the source file. |
| Ghosia | Today's times only | No |
| Noorul Islam (MNI/MMI) | Today's times only, loaded by script, two locations | No |
| Everyone else | No site, a dead domain, or no times | No |

There is no API behind any of this. MasjidBox states it has no public
prayer-times API; MyMasjid publishes none. AlAdhan and muslimsalat return
*calculated adhan* times, which are not a masjid's jamā'ah times and are not
what this screen shows.

### What the Ashrafia extraction found

`tools/import-ashrafia-pdf.py` parses their PDF and checks every day it
produces: beginning times must be in order, and no jamā'ah may fall before its
prayer begins or more than four hours after. **361 days passed every check.
Zero failed.**

The four it would not emit are the interesting part, and all four are days you
would least want to get wrong:

| Date | What's there |
| --- | --- |
| 18–19 Feb | **Absent from the PDF.** The table jumps 17 → 20. These are the first two days of Ramadan, which the masjid puts on a separate Ramadan page. |
| 25 Mar | Fajr is printed **`422`** — a missing decimal point. Neighbouring days are 4.25 and 4.21, so 4.22 is obviously meant. The tool refuses to guess. |
| 29 Mar | **Absent from the PDF.** The table jumps 28 → 30. This is the day the clocks go forward. |

A scraper that silently filled those gaps by carrying the previous day forward
would put the wrong Fajr on a kitchen wall on the morning the clocks change,
and would do it quietly. That is the whole argument for confirming with the
masjid in one sentence.

It is also worth telling Ashrafia: three missing days and a typo in their own
published timetable is useful to them regardless of whether they join.

## Live audio already running

| Masjid | Evidence |
| --- | --- |
| Taiyabah | `taiyabahmbolton.radioca.st/stream.mp3` — Shoutcast DNAS 2.6.1, `icy-br: 128`, measured 126 kbps sustained |
| Zakariyya | A **Live Broadcast** page on their site, and an app that streams azaan and talks in the background |
| Noorul Islam | A **Live Radio** player on their site |
| Ghosia | A third-party page relays their programmes |

So at least three Bolton masjids beyond Taiyabah already stream. That is the
opening line for the conversation: they have already decided they want to be
heard at home.

## Logos

Found, not downloaded. A masjid's mark is theirs, and the right time to get it
is when they agree to join — at which point they will send a better file than
anything scraped.

| Masjid | Where |
| --- | --- |
| Ashrafia | `ashrafiamasjid.org/wp-content/uploads/2022/09/pnglogo.png` |
| Ghosia | Supabase `organisation-assets/.../branding/logo.png` |
| Zakariyya | `s3-cloud.cr8tive-digital.com/zjm/images/…png` |
| Noorul Islam | `sunnahsource.org/boltonwebsite/m.jpg` (and `2m.jpeg` for MMI) |

None are needed. A masjid with no logo gets its name set as a wordmark, which
is why joining needs no artwork.

## Contacts

The Bolton Council of Mosques lists 27 masjids with phone numbers, and **BCOM
itself is the single most useful contact on this page** — one conversation with
them is worth nine cold calls, and they are the body that can say whether a
shared screen is something the Bolton masjids want at all.

Their published list has stale web addresses: six domains do not resolve
(`zakariyyajaamemasjid.co.uk`, `makkahmosque.org.uk`, `alfalahmosque.co.uk`,
`attowfiiqmasjid.org`, `boltondarululoom.org`, `deen-iec.org.uk`), and even
Taiyabah is listed under `.co.uk` when the live site is `.com`. Zakariyya's
real site is `zakariyyamasjid.co.uk`. Use the phone numbers, not the links.

## What to ask for, in one call

1. A **full-year timetable** — the file they made the PDF from, not the PDF.
2. Permission to **carry their stream**, and the **https** URL of it.
3. Confirmation of their **receiver frequency**, so the picker can show it.
4. Their **logo**, if they want one. Optional.

One ask, four answers, and the masjid gets a free screen in their congregation's
homes carrying their adhan. That is a better conversation than asking for
bandwidth and giving nothing back.
