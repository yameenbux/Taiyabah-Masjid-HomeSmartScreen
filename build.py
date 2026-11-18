#!/usr/bin/env python3
"""Build index.html from template.html + the JSON in data/.

template.html is the source of truth. index.html is generated output and is
what GitHub Pages serves from the root of main — never hand-edit it, the next
run of this script will overwrite whatever you changed.

The substitution is deliberately dumb (placeholder replacement, no bundler).
The asserts are the important part: a placeholder left un-substituted still
produces a page that loads, just with a JS syntax error and no data, so catch
it here rather than on a live tablet in somebody's kitchen.

Every masjid on the screen is a directory under data/masjids/:

    data/masjids/<id>/profile.json        name, contact, stream, give, appeal
    data/masjids/<id>/timetable-YYYY.json one file per year
    data/masjids/<id>/donate-qr.svg       optional, with .url beside it

Adding a masjid is adding a directory. Nothing in this file lists them.

    python3 build.py
"""

import datetime
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
MASJID_DIR = ROOT / "data" / "masjids"

# The masjid a device shows before anyone has chosen one: the masjid whose
# project this is, so the masjid's own wall screens need no setup at all.
DEFAULT_MASJID = "taiyabah"

SOURCES = {
    "__OCCASIONS_JSON__": "data/occasions.json",
    "__TUNING_JSON__": "data/tuning.json",
}

# Optional asset. The page used to request masjidone-logo.svg unconditionally
# and fall back to a text wordmark on error — which worked, but logged a 404
# on every load of every device, forever, and that noise is exactly what
# hides a real error when one turns up. Resolve it at build time instead: if
# the file is not in the repo the page never asks for it.
OPTIONAL_ASSETS = {
    "__BRAND_MARK__": "masjidone-logo.svg",
}


def load_timetable(folder, masjid_id):
    """Merge every timetable-YYYY.json in a masjid's folder into one blob.

    The merge is checked. Overlapping dates mean a year was duplicated, and a
    gap means a day on which that masjid's congregation would see "prayer
    times need updating" in the middle of an otherwise fine run — the silent
    failure the expiry handling exists to prevent. Fail here, not on a wall.
    """
    files = sorted(folder.glob("timetable-*.json"))
    assert files, "%s has no timetable-YYYY.json — a masjid with no times " \
                  "would show its congregation nothing" % folder

    days = {}
    for path in files:
        blob = json.loads(path.read_text(encoding="utf-8"))
        year = blob.get("days", blob)
        clash = sorted(set(year) & set(days))
        assert not clash, "%s repeats dates already loaded: %s" % (
            path.name, ", ".join(clash[:3]))
        days.update(year)

    keys = sorted(days)
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
            "%s has %d gap(s) between %s and %s, starting at %s — a missing "
            "day leaves that masjid with no prayer times on that date"
            % (masjid_id, len(missing), keys[0], keys[-1], missing[0]))

    return days, keys[0], keys[-1]


def donation_qr(folder, give, masjid_id):
    """Inline a masjid's donation QR, after checking it encodes the right URL.

    Nobody proof-reads a QR code by eye, so a changed donation link with a
    stale QR beside it would send every scan to the wrong place and look
    completely fine on screen. tools/make-qr.py records the URL it encoded
    next to the image; if that disagrees with the profile, the build stops.
    """
    if not give or not give.get("qrEnabled", True):
        return None
    svg = folder / "donate-qr.svg"
    stamp = folder / "donate-qr.url"
    wanted = give.get("qrUrl") or give.get("otherAmountUrl")
    if not wanted or not svg.exists() or not stamp.exists():
        print("note: %s has no donation QR (run tools/make-qr.py %s)"
              % (masjid_id, masjid_id))
        return None

    encoded = stamp.read_text(encoding="utf-8").strip()
    assert encoded == wanted, (
        "%s's QR encodes %s but its profile now says %s — run "
        "tools/make-qr.py %s" % (masjid_id, encoded, wanted, masjid_id))

    markup = svg.read_text(encoding="utf-8")
    if markup.lstrip().startswith("<?xml"):          # strip the XML prolog
        markup = markup.split("?>", 1)[1]
    return markup.strip()


def load_masjids():
    """Every masjid directory, the default one first, then alphabetical.

    Order is the order of the setup list, so the masjid running the project
    appears at the top rather than wherever the alphabet puts it.
    """
    assert MASJID_DIR.is_dir(), "data/masjids/ is missing"
    folders = sorted(p for p in MASJID_DIR.iterdir() if (p / "profile.json").is_file())
    assert folders, "no masjids in data/masjids/"

    out = []
    for folder in folders:
        p = json.loads((folder / "profile.json").read_text(encoding="utf-8"))
        mid = p.get("id") or folder.name
        assert mid == folder.name, (
            "%s/profile.json says id %r — the id must match the folder name, "
            "because the folder name is what a device stores" % (folder.name, mid))
        assert p.get("name"), "%s has no name" % mid

        days, first, last = load_timetable(folder, mid)
        stream = p.get("stream") or {}
        url = stream.get("url")
        if url:
            assert url.startswith("https://"), (
                "%s's stream url must be https, got %r. The page is served "
                "over HTTPS, so a plain-http stream is blocked as mixed "
                "content and fails silently." % (mid, url))

        logo = p.get("logo")
        if logo:
            assert (ROOT / logo).exists(), (
                "%s's profile points at logo %r, which is not in the repo. A "
                "missing logo would 404 on every load of every device forever."
                % (mid, logo))

        out.append({
            "id": mid,
            "name": p["name"],
            "shortName": p.get("shortName") or p["name"],
            "logo": logo or None,
            # The receiver number people already know this masjid by. Shown in
            # the picker as a recognition aid; nothing receives it.
            "frequency": p.get("frequency") or None,
            # True until the masjid has confirmed its timetable. The screen
            # says so in the open rather than letting it pass as fact.
            "provisional": bool(p.get("provisional")),
            "contact": p.get("contact") or None,
            "stream": stream or None,
            "give": p.get("give") or None,
            "appeal": p.get("appeal") or None,
            "qr": donation_qr(folder, p.get("give"), mid),
            "days": days,
        })
        print("  %-12s %4d days %s -> %s%s%s" % (
            mid, len(days), first, last,
            "  stream" if url else "  NO STREAM",
            "  qr" if out[-1]["qr"] else ""))

    ids = [m["id"] for m in out]
    assert DEFAULT_MASJID in ids, (
        "the default masjid %r has no directory — a device with no choice "
        "stored would have nothing to show" % DEFAULT_MASJID)

    urls = [m["stream"]["url"] for m in out if m.get("stream") and m["stream"].get("url")]
    dupe = next((u for u in urls if urls.count(u) > 1), None)
    assert dupe is None, (
        "two masjids share the stream url %r — one profile is almost "
        "certainly a copy-paste of another" % dupe)

    out.sort(key=lambda m: (m["id"] != DEFAULT_MASJID, m["name"].lower()))
    return out


def main():
    out = (ROOT / "template.html").read_text(encoding="utf-8")

    print("masjids:")
    masjids = load_masjids()

    out = out.replace(
        "__MASJIDS_JSON__",
        json.dumps(masjids, separators=(",", ":"), ensure_ascii=False),
    )
    out = out.replace("__DEFAULT_MASJID__", json.dumps(DEFAULT_MASJID))

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

    for placeholder in ["__MASJIDS_JSON__", "__DEFAULT_MASJID__"] \
            + list(SOURCES) + list(OPTIONAL_ASSETS):
        assert placeholder not in out, "%s was not substituted" % placeholder

    (ROOT / "index.html").write_text(out, encoding="utf-8")
    print("index.html written (%d bytes, %d masjid(s))"
          % (len(out.encode("utf-8")), len(masjids)))


if __name__ == "__main__":
    main()
