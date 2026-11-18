#!/usr/bin/env python3
"""Build a demo page with the Bolton masjids in it, so the thing can be seen.

    python3 tools/make-demo.py out.html

Two masjids carry real prayer times: Taiyabah's own, and Ashrafia's, extracted
from the 2026 PDF they publish. The other eight carry SAMPLE times and say so —
on the picker row, and on a band across the top of the screen the whole time
that masjid is selected. Their names, addresses and receiver frequencies are
real; the jamaat times are not, because only a masjid can give those.

Beginning times are shared, which is not a shortcut: Fajr, sunrise, Maghrib and
the rest are astronomical and identical across Bolton. Jamaat is the human
decision, and it is the part being stood in for.

Nothing here is written into data/masjids/ and the demo is not the build.
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Names, addresses and frequencies from docs/bolton-masjids.md. Frequencies
# marked (2026) come from the masjid's own published material this year; the
# rest are scanner logs from 2014-2016 and are a question, not a fact.
OTHERS = [
    ("zakariyya", "Zakariyya Jaam'e Masjid", "Zakariyya", "Peace Street, Bolton BL3 5LJ", "01204 535002", "454.275", 0),
    ("ghosia",    "Masjid-e-Ghosia",         "Ghosia",    "St Pauls Mill, Caroline Street, Bolton BL3 6SX", "01204 650583", None, 5),
    ("noorul",    "Masjid-e-Noorul Islam",   "Noorul Islam", "Prospect Street, Bolton BL1 3QH", "01204 535738", "454.794", -5),
    ("makki",     "Makki Masjid",            "Makki",     "110 Eskrick Street, Bolton BL1 3EN", "01204 848909", "454.406", 10),
    ("alrahman",  "Al Rahman Mosque",        "Al Rahman", "2-14 Randal Street, Bolton BL3 4AQ", "01204 660177", None, -10),
    ("makkah",    "Makkah Mosque",           "Makkah",    "Grecian Crescent, Bolton BL3 6QU", "01204 524200", None, 15),
    ("madina",    "New Madina Mosque",       "Madina",    "Gower Street, Bolton BL1 4BB", "01204 520952", "455.475", -15),
    ("darululoom","Bolton Darul Uloom",      "Darul Uloom", "Willows Lane, Bolton BL3 4HE", "01204 62622", None, 20),
]


def shift(hhmm, mins):
    h, m = int(hhmm[:2]), int(hhmm[3:])
    t = (h * 60 + m + mins) % 1440
    return "%02d:%02d" % (t // 60, t % 60)


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "demo.html"
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    m = re.search(r'const MASJIDS = (\[.*?\]);\n', html)
    if not m:
        raise SystemExit("could not find MASJIDS in index.html — run build.py first")
    base = json.loads(m.group(1))
    taiyabah = base[0]
    masjids = [taiyabah]

    # Ashrafia: real, from their own published 2026 PDF
    cand = ROOT.parent / "ashrafia-2026-CANDIDATE.json"
    for p in (cand, pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else cand):
        if p.exists():
            days = json.loads(p.read_text(encoding="utf-8"))["days"]
            masjids.append({
                "id": "ashrafia", "name": "Ashrafia Masjid", "shortName": "Ashrafia",
                "logo": None, "frequency": "454.250", "provisional": False,
                "contact": {"address": "52 Gibraltar Street, Bolton BL3 5ED",
                            "phone": "07817 529893",
                            "website": "https://ashrafiamasjid.org",
                            "websiteLabel": "ashrafiamasjid.org"},
                "stream": None, "give": None, "appeal": None, "qr": None,
                "days": days,
            })
            print("  ashrafia     %d days (real, from their published PDF)" % len(days))
            break

    for mid, name, short, addr, phone, freq, off in OTHERS:
        days = {}
        for d, rec in taiyabah["days"].items():
            days[d] = {
                "hijri": rec.get("hijri"),
                # astronomical, and the same across the town
                "begins": dict(rec["begins"]),
                # the human decision, stood in for
                "jamaat": {k: shift(v, off) for k, v in rec["jamaat"].items()},
            }
            if rec.get("jummah"):
                days[d]["jummah"] = {k: shift(v, off) if re.match(r'^\d{2}:\d{2}$', str(v)) else v
                                     for k, v in rec["jummah"].items()}
        masjids.append({
            "id": mid, "name": name, "shortName": short, "logo": None,
            "frequency": freq, "provisional": True,
            "contact": {"address": addr, "phone": phone},
            "stream": {"enabled": True, "name": name,
                       "url": "https://taiyabahmbolton.radioca.st/stream.mp3"},
            "give": None, "appeal": None, "qr": None, "days": days,
        })
        print("  %-12s SAMPLE jamaat (%+d min)%s" % (mid, off, "  %s" % freq if freq else ""))

    demo = html.replace(m.group(0), 'const MASJIDS = ' + json.dumps(masjids, separators=(",", ":")) + ';\n')
    pathlib.Path(out_path).write_text(demo, encoding="utf-8")
    real = sum(1 for x in masjids if not x.get("provisional"))
    print("\n%s — %d masjids (%d real times, %d sample)"
          % (out_path, len(masjids), real, len(masjids) - real))


if __name__ == "__main__":
    main()
