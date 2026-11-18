#!/usr/bin/env python3
"""Turn Ashrafia Masjid's published 2026 PDF timetable into our JSON format.

    python3 tools/import-ashrafia-pdf.py ashrafia-2026.pdf out.json

This is written for ONE masjid's layout, deliberately. Ashrafia publishes a
proper annual timetable with a text layer; most Bolton masjids publish a daily
table or a scanned image, and no amount of generalising makes those parseable.

Two things in that table would be easy to get wrong, so they are handled
explicitly and checked afterwards:

  Ditto marks. A value is printed only when it changes and is a " on every row
  until it changes again, so every column carries forward. This is how the same
  table holds a jamaat that steps weekly and a Maghrib that moves daily.

  No am/pm. Times are printed as H.MM with no meridiem, so each column is
  converted by what that prayer can actually be, not by a rule of thumb. The
  checks at the end are what make that safe: if an inference were wrong the day
  would come out unordered and the run would fail rather than emit it.

Output is a CANDIDATE. It is not the masjid's word until they have looked at
it, so it does not go into data/masjids/ from here.
"""

import json
import re
import subprocess
import sys

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
DITTO = {'"', '"', '"', "''", "'"}
# Some rows carry a leading asterisk (the masjid marks certain days). Dropping
# those rows silently cost three days of the year on the first run, so the
# marker is matched and ignored rather than allowed to fail the line.
ROW = re.compile(r'^\s*\*?\s*(\d{1,2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(.*)$')


def to24(tok, lo, hi):
    """H.MM with no meridiem -> HH:MM, picking the reading inside [lo,hi]."""
    m = re.match(r'^(\d{1,2})[.:](\d{2})$', tok)
    if not m:
        raise ValueError("not a time: %r" % tok)
    h, mi = int(m.group(1)), int(m.group(2))
    if mi > 59:
        raise ValueError("bad minutes: %r" % tok)
    for cand in (h, h + 12, h - 12):
        if 0 <= cand <= 23 and lo <= cand <= hi:
            return "%02d:%02d" % (cand, mi)
    raise ValueError("%r fits no hour between %d and %d" % (tok, lo, hi))


# column -> the hours that prayer can plausibly fall in, in Bolton
BOUNDS = [
    ("b_fajr",    1, 8),    ("b_sunrise", 3, 9),   ("b_dhuhr",  11, 14),
    ("b_asr",    12, 20),   ("b_sunset", 14, 22),  ("b_isha",   15, 23),
    ("j_fajr",    2, 9),    ("j_dhuhr",  11, 15),  ("j_asr",    12, 21),
    ("j_maghrib", 14, 22),  ("j_isha",   15, 23),
]


def parse(pdf):
    days, carry, problems = {}, {}, []
    for page in range(1, 40):
        try:
            txt = subprocess.run(["pdftotext", "-layout", "-f", str(page), "-l", str(page),
                                  pdf, "-"], capture_output=True, text=True, check=True).stdout
        except subprocess.CalledProcessError:
            break
        if not txt.strip():
            continue
        head = re.search(r'\b(%s)\s+(\d{4})\b' % "|".join(MONTHS), txt)
        if not head:
            continue
        month, year = MONTHS.index(head.group(1)) + 1, int(head.group(2))
        carry = {}                       # ditto never crosses a month boundary
        for line in txt.splitlines():
            m = ROW.match(line)
            if not m:
                continue
            dom, _dow, _lunar, rest = int(m.group(1)), m.group(2), m.group(3), m.group(4)
            toks = rest.split()
            if len(toks) < len(BOUNDS):
                # ditto marks collapse columns; pad from the right is unsafe, so
                # only accept a row we can line up exactly
                toks = toks + [None] * (len(BOUNDS) - len(toks)) if len(toks) >= 6 else toks
            if len(toks) != len(BOUNDS):
                problems.append("%04d-%02d-%02d: %d columns, expected %d"
                                % (year, month, dom, len(toks), len(BOUNDS)))
                continue
            rec = {}
            for (name, lo, hi), tok in zip(BOUNDS, toks):
                if tok is None or tok in DITTO:
                    if name not in carry:
                        problems.append("%04d-%02d-%02d: %s is a ditto with nothing above it"
                                        % (year, month, dom, name))
                        rec = None
                        break
                    rec[name] = carry[name]
                    continue
                try:
                    rec[name] = to24(tok, lo, hi)
                except ValueError as e:
                    problems.append("%04d-%02d-%02d: %s %s" % (year, month, dom, name, e))
                    rec = None
                    break
            if rec is None:
                continue
            carry.update(rec)
            days["%04d-%02d-%02d" % (year, month, dom)] = {
                "begins": {"fajr": rec["b_fajr"], "sunrise": rec["b_sunrise"],
                           "zuhr": rec["b_dhuhr"], "asr": rec["b_asr"],
                           "maghrib": rec["b_sunset"], "isha": rec["b_isha"]},
                "jamaat": {"fajr": rec["j_fajr"], "zuhr": rec["j_dhuhr"],
                           "asr": rec["j_asr"], "maghrib": rec["j_maghrib"],
                           "isha": rec["j_isha"]},
            }
    return days, problems


def verify(days):
    """The checks that make the am/pm inference safe to rely on."""
    bad = []
    mins = lambda t: int(t[:2]) * 60 + int(t[3:])
    for d in sorted(days):
        b, j = days[d]["begins"], days[d]["jamaat"]
        order = ["fajr", "sunrise", "zuhr", "asr", "maghrib", "isha"]
        seq = [mins(b[k]) for k in order]
        if seq != sorted(seq):
            bad.append("%s: beginning times are out of order (%s)"
                       % (d, ", ".join("%s %s" % (k, b[k]) for k in order)))
        for k in ("fajr", "zuhr", "asr", "maghrib", "isha"):
            gap = mins(j[k]) - mins(b[k])
            if gap < 0:
                bad.append("%s: %s jamaat %s is BEFORE it begins at %s" % (d, k, j[k], b[k]))
            elif gap > 240:
                bad.append("%s: %s jamaat %s is %dh after it begins at %s"
                           % (d, k, j[k], gap // 60, b[k]))
    return bad


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    days, problems = parse(sys.argv[1])
    print("parsed %d days" % len(days))
    if days:
        ks = sorted(days)
        print("  %s -> %s" % (ks[0], ks[-1]))
    for p in problems[:15]:
        print("  PARSE: %s" % p)
    bad = verify(days)
    for b in bad[:15]:
        print("  CHECK: %s" % b)
    if len(bad) > 15:
        print("  ... and %d more" % (len(bad) - 15))
    if problems or bad:
        print("\n%d parse problem(s), %d failed check(s) — NOT writing output"
              % (len(problems), len(bad)))
        return 1
    year = sorted(days)[0][:4]
    json.dump({"masjid": "Ashrafia Masjid", "year": int(year),
               "source": "ashrafiamasjid.org published PDF timetable %s" % year,
               "timezone": "Europe/London",
               "status": "CANDIDATE — extracted from the masjid's published PDF, "
                         "not yet confirmed by the masjid",
               "days": days},
              open(sys.argv[2], "w"), indent=1, ensure_ascii=False)
    print("\nwrote %s (%d days) — candidate, needs the masjid's confirmation" % (sys.argv[2], len(days)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
