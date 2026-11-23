# Adding a masjid

Every masjid on the screen is a directory under `data/masjids/`. Adding one is
adding a directory — nothing lists them, and no code changes.

```
data/masjids/<id>/profile.json          name, contact, stream, give, appeal
data/masjids/<id>/timetable-2026.json   one file per year
data/masjids/<id>/donate-qr.svg         optional, with donate-qr.url beside it
```

```bash
python3 tools/add-masjid.py zakariyya "Zakariyya Jaame Masjid"   # scaffold
python3 tools/add-masjid.py zakariyya --check                    # validate
python3 build.py
```

## The thing to be honest about first

**There is no API for a masjid's jamā'ah times.** MasjidBox states plainly that
it has no public prayer-times API; MyMasjid publishes none. The calculated
services — AlAdhan, muslimsalat — return *adhan* times from a formula, which is
not the same thing and is not what this screen is for. Iqāmah is a human
decision that only the masjid can tell you.

So every masjid on this screen is a timetable somebody collected, checked and
committed, and will have to collect again next year. That is the real cost of
the directory, and it is worth saying out loud before promising ten of them.
The dropdown is the cheap part.

Two things follow:

- **Make the timetable the price of admission.** A masjid joining gets a free
  screen in their congregation's homes showing their times and carrying their
  adhan. Supplying a year of times and agreeing to the stream is what they give
  back. Ask for both in the same conversation.
- **Know when each one runs out.** `tools/add-masjid.py <id> --check` prints
  "runs out in N days". Put a reminder in the calendar at 60 days for every
  masjid, because the screen's own expiry notice is a last line of defence, not
  a plan.

## What to ask a masjid for

| | Needed? | If it's missing |
| --- | --- | --- |
| A year of prayer times | **Yes** | They cannot be on the screen at all. |
| Permission to carry their stream | **Yes**, if they want to be listened to | They appear with times only. Since the recorded adhan was removed (`7f6f976`) there is no substitute: a household on that masjid hears no adhan from the screen at all. |
| Their stream URL | For listening | Must be **https** — a plain-http mount is blocked as mixed content and fails *silently*. Test the exact endpoint in a browser, not a media player. |
| Contact details | No | The "Visit or get in touch" button is hidden for them. |
| A donation link | No | No QR for them. |
| A logo | No | Their name is set as a wordmark instead, which is why joining needs no artwork. |

A masjid with nothing but a name and a timetable is a valid, complete profile.
That is deliberate: the barrier to joining should be the times, not a branding
exercise.

## The timetable format

Match `data/masjids/taiyabah/timetable-2026.json`. Per day, keyed `YYYY-MM-DD`:

```json
"2026-01-01": {
  "hijri": "12 Rajab 1447 AH",
  "begins": { "fajr": "06:36", "sunrise": "08:26", "zuhr": "12:20",
              "asr": "14:13", "maghrib": "16:06", "isha": "17:48" },
  "jamaat": { "fajr": "07:45", "zuhr": "12:45", "asr": "14:45",
              "maghrib": "16:06", "isha": "18:30" }
}
```

24-hour times. Fridays may add a `jummah` block; without one the screen falls
back to showing Zuhr that day, which `--check` warns about rather than failing.

The build refuses: a gap between the first and last date, a duplicated date, a
missing jamā'ah time, a non-https stream, two masjids sharing a stream URL, a
profile whose `id` does not match its folder, a `logo` that is not in the repo,
and a QR that no longer matches the URL in the profile. Every one of those is a
failure that would otherwise be invisible on a wall.

## What it costs the page

All masjids are inlined rather than fetched, so the page keeps working with no
network and switching masjid is instant. Ten masjids of two years each is about
1.9 MB raw and **under 200 KB over the wire** once gzipped. There is room for
roughly twenty before that is worth revisiting.

## Who appears on the list

A decision for the masjid committee, not a technical one, and not ours. The
same applies to the order — the default masjid is first so its own wall screens
need no setup, and everyone else is alphabetical.
