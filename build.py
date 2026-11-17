#!/usr/bin/env python3
"""Build index.html from template.html + the JSON in data/.

template.html is the source of truth. index.html is generated output and is
what GitHub Pages serves from the root of main — never hand-edit it, the next
run of this script will overwrite whatever you changed.

The substitution is deliberately dumb (three placeholder replacements, no
bundler). The asserts at the end are the important part: a placeholder left
un-substituted still produces a page that loads, just with a JS syntax error
and no data, so catch it here rather than on a live tablet.

    python3 build.py
"""

import datetime
import json
import pathlib

ROOT = pathlib.Path(__file__).parent

# Prayer times are split one file per year and merged into a single blob at
# build time, so adding a year is adding a file to this list and nothing
# else. The merge is checked: overlapping dates mean a file was listed twice
# or a year was duplicated, and a gap means a day on which the screen would
# show "prayer times need updating" in the middle of an otherwise fine run —
# which is the silent failure the expiry handling exists to prevent, so it
# fails the build rather than reaching a wall.
TIMETABLES = [
    "data/timetable-2026.json",
    "data/timetable-2027.json",
]

SOURCES = {
    "__NEWBUILD_JSON__": "data/newbuild.json",
    "__OCCASIONS_JSON__": "data/occasions.json",
    "__STREAM_JSON__": "data/stream.json",
}

# Optional asset. The page used to request masjidone-logo.svg unconditionally
# and fall back to a text wordmark on error — which worked, but logged a 404
# on every load of every device, forever, and that noise is exactly what
# hides a real error when one turns up. Resolve it at build time instead: if
# the file is not in the repo the page never asks for it. Dropping the real
# logo in at this path and rebuilding is still the only step needed.
OPTIONAL_ASSETS = {
    "__BRAND_MARK__": "masjidone-logo.svg",
}


def load_timetable():
    """Merge every year in TIMETABLES into one {"days": {...}} blob."""
    days = {}
    for relpath in TIMETABLES:
        blob = json.loads((ROOT / relpath).read_text(encoding="utf-8"))
        year = blob.get("days", blob)
        clash = sorted(set(year) & set(days))
        assert not clash, "%s repeats dates already loaded: %s" % (
            relpath, ", ".join(clash[:3]))
        days.update(year)

    keys = sorted(days)
    assert keys, "no prayer times loaded at all"
    first = datetime.date.fromisoformat(keys[0])
    last = datetime.date.fromisoformat(keys[-1])
    expected = (last - first).days + 1
    if len(keys) != expected:
        have = set(keys)
        missing = [
            (first + datetime.timedelta(days=i)).isoformat()
            for i in range(expected)
            if (first + datetime.timedelta(days=i)).isoformat() not in have
        ]
        raise AssertionError(
            "the timetable has %d gap(s) between %s and %s, starting at %s — "
            "a missing day leaves the screen with no prayer times on that date"
            % (len(missing), keys[0], keys[-1], missing[0]))

    print("timetable: %d days, %s -> %s" % (len(keys), keys[0], keys[-1]))
    return {"days": days}


def donation_qr():
    """Inline the donation QR, after checking it still encodes the right URL.

    Nobody proof-reads a QR code by eye, so a changed donation link with a
    stale QR beside it would send every scan to the wrong place and look
    completely fine on screen. tools/make-qr.py records the URL it encoded
    next to the image; if that disagrees with the data, the build stops.
    """
    svg = ROOT / "donate-qr.svg"
    stamp = ROOT / "donate-qr.url"
    give = json.loads((ROOT / "data" / "newbuild.json").read_text(encoding="utf-8"))["give"]
    wanted = give.get("qrUrl") or give["otherAmountUrl"]

    if not give.get("qrEnabled", True):
        return ""
    if not svg.exists() or not stamp.exists():
        print("note: no donation QR (run tools/make-qr.py) — the block is omitted")
        return ""

    encoded = stamp.read_text(encoding="utf-8").strip()
    assert encoded == wanted, (
        "the donation QR encodes %s but data/newbuild.json now says %s — "
        "run tools/make-qr.py" % (encoded, wanted))

    markup = svg.read_text(encoding="utf-8")
    # Strip the XML prolog so it can be inlined straight into the page.
    if markup.lstrip().startswith("<?xml"):
        markup = markup.split("?>", 1)[1]
    return markup.strip()


def main():
    out = (ROOT / "template.html").read_text(encoding="utf-8")

    out = out.replace("__DONATE_QR_SVG__", donation_qr())

    out = out.replace(
        "__TIMETABLE_JSON__",
        json.dumps(load_timetable(), separators=(",", ":"), ensure_ascii=False),
    )

    for placeholder, relpath in SOURCES.items():
        blob = json.loads((ROOT / relpath).read_text(encoding="utf-8"))
        out = out.replace(
            placeholder,
            json.dumps(blob, separators=(",", ":"), ensure_ascii=False),
        )

    for placeholder, relpath in OPTIONAL_ASSETS.items():
        present = (ROOT / relpath).exists()
        out = out.replace(placeholder, json.dumps(relpath if present else None))
        if not present:
            print("note: %s is not in the repo — the page will use its text "
                  "fallback and will not request it" % relpath)

    assert "__TIMETABLE_JSON__" not in out, "__TIMETABLE_JSON__ was not substituted"
    assert "__DONATE_QR_SVG__" not in out, "__DONATE_QR_SVG__ was not substituted"
    for placeholder in list(SOURCES) + list(OPTIONAL_ASSETS):
        assert placeholder not in out, "%s was not substituted" % placeholder

    (ROOT / "index.html").write_text(out, encoding="utf-8")
    print("index.html written (%d bytes)" % len(out.encode("utf-8")))


if __name__ == "__main__":
    main()
