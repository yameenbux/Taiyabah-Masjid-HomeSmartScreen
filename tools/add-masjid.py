#!/usr/bin/env python3
"""Scaffold a new masjid, and check a timetable before it reaches a device.

    python3 tools/add-masjid.py zakariyya "Zakariyya Jaame Masjid"
    python3 tools/add-masjid.py zakariyya --check

The first form creates data/masjids/<id>/profile.json ready to fill in. The
second validates whatever timetables are in that folder and prints what is
still missing. build.py does the same checks and refuses to build on failure;
this exists so you find out while you still have the masjid on the phone,
rather than after a hundred screens have shipped.

Nothing here invents prayer times. A masjid's jama'ah times are a human
decision that only that masjid can tell you — there is no API for them, and a
calculated time is not the same thing.
"""

import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MASJIDS = ROOT / "data" / "masjids"
PRAYERS = ("fajr", "zuhr", "asr", "maghrib", "isha")

SKELETON = {
    "id": None,
    "name": None,
    "shortName": None,
    "logo": None,
    "contact": {"address": "", "phone": "", "email": "", "website": "", "charity": ""},
    "stream": {"enabled": False, "name": None, "url": ""},
    "give": None,
    "appeal": None,
}


def check(folder, mid):
    problems, notes = [], []
    profile = json.loads((folder / "profile.json").read_text(encoding="utf-8"))

    if not profile.get("name"):
        problems.append("profile.json has no name")
    stream = profile.get("stream") or {}
    url = stream.get("url")
    if not url:
        notes.append("no stream URL yet — the screen works, but this masjid "
                     "cannot be listened to and its adhan will be the recording")
    elif not url.startswith("https://"):
        problems.append("stream url is not https (%s) — it would be blocked as "
                        "mixed content and fail silently" % url)
    if not profile.get("contact"):
        notes.append("no contact details — the 'Visit or get in touch' button is hidden")
    if not profile.get("give"):
        notes.append("no give block — no donation QR for this masjid")

    files = sorted(folder.glob("timetable-*.json"))
    if not files:
        problems.append("no timetable-YYYY.json — this masjid has no prayer times")
    days = {}
    for path in files:
        blob = json.loads(path.read_text(encoding="utf-8"))
        year = blob.get("days", blob)
        for d, rec in year.items():
            try:
                datetime.date.fromisoformat(d)
            except ValueError:
                problems.append("%s: %r is not a YYYY-MM-DD date" % (path.name, d))
                continue
            if d in days:
                problems.append("%s: %s appears twice" % (path.name, d))
            missing = [p for p in PRAYERS if not (rec.get("jamaat") or {}).get(p)]
            if missing:
                problems.append("%s %s: no jama'ah time for %s"
                                % (path.name, d, ", ".join(missing)))
            days[d] = rec

    if days:
        keys = sorted(days)
        first = datetime.date.fromisoformat(keys[0])
        last = datetime.date.fromisoformat(keys[-1])
        span = (last - first).days + 1
        if len(keys) != span:
            have = set(keys)
            gaps = [(first + datetime.timedelta(days=i)).isoformat()
                    for i in range(span)
                    if (first + datetime.timedelta(days=i)).isoformat() not in have]
            problems.append("%d missing day(s) between %s and %s, first is %s"
                            % (len(gaps), keys[0], keys[-1], gaps[0]))
        fridays = [d for d in keys if datetime.date.fromisoformat(d).weekday() == 4]
        without = [d for d in fridays if not days[d].get("jummah")]
        if without:
            notes.append("%d Friday(s) have no jummah block, first %s — the "
                         "screen falls back to Zuhr on those days"
                         % (len(without), without[0]))
        print("  timetable: %d days, %s -> %s" % (len(keys), keys[0], keys[-1]))
        left = (last - datetime.date.today()).days
        print("  runs out in %d days (%s)" % (left, last))

    for n in notes:
        print("  note:    %s" % n)
    for p in problems:
        print("  PROBLEM: %s" % p)
    print("  %s" % ("ready to build" if not problems else
                    "%d problem(s) — build.py will refuse this" % len(problems)))
    return 1 if problems else 0


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    mid = sys.argv[1]
    folder = MASJIDS / mid

    if "--check" in sys.argv:
        if not (folder / "profile.json").is_file():
            raise SystemExit("no such masjid: %s" % mid)
        print("%s:" % mid)
        raise SystemExit(check(folder, mid))

    if len(sys.argv) < 3:
        raise SystemExit("give the masjid's full name:\n  "
                         "python3 tools/add-masjid.py %s \"Full Name Masjid\"" % mid)
    name = sys.argv[2]
    if folder.exists():
        raise SystemExit("%s already exists" % folder)

    folder.mkdir(parents=True)
    p = dict(SKELETON)
    p["id"], p["name"], p["shortName"] = mid, name, name.split()[0]
    p["stream"] = dict(SKELETON["stream"], name=name)
    (folder / "profile.json").write_text(
        json.dumps(p, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print("created %s/profile.json\n" % folder)
    print("Still needed from the masjid:")
    print("  1. their timetable, as data/masjids/%s/timetable-YYYY.json" % mid)
    print("     (same shape as taiyabah's — begins + jamaat per day, jummah on Fridays)")
    print("  2. their stream URL, and their agreement to our screens using it")
    print("  3. contact details, if they want the 'Visit or get in touch' button")
    print("\nThen: python3 tools/add-masjid.py %s --check && python3 build.py" % mid)


if __name__ == "__main__":
    main()
