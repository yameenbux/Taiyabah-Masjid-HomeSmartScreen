#!/usr/bin/env python3
"""Regenerate a masjid's donation QR from the URL in its profile.

    python3 tools/make-qr.py <masjid-id>        (default: taiyabah)

Run this whenever the donation link changes:

    pip install segno
    python3 tools/make-qr.py

It writes donate-qr.svg and donate-qr.url into that masjid's folder.
build.py refuses to build if
those two disagree with the URL in the data, so a changed link can never
quietly leave an old QR pointing somewhere else — which is the failure
that matters here, since nobody proof-reads a QR code by eye.

segno is a build-time tool only and is deliberately NOT a dependency of
build.py, which stays standard-library so a fresh clone can build with
nothing installed.
"""
import json
import pathlib
import sys

try:
    import segno
except ImportError:
    sys.exit("segno is not installed. Run: pip install segno")

import sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
MASJID = sys.argv[1] if len(sys.argv) > 1 else "taiyabah"
FOLDER = ROOT / "data" / "masjids" / MASJID
if not (FOLDER / "profile.json").is_file():
    raise SystemExit("no such masjid: %s (looked in %s)" % (MASJID, FOLDER))
give = json.loads((FOLDER / "profile.json").read_text(encoding="utf-8")).get("give") or {}
url = give.get("qrUrl") or give.get("otherAmountUrl")
if not url:
    raise SystemExit("%s has no give.qrUrl or give.otherAmountUrl — nothing to encode" % MASJID)

# Error correction L, not M. M buys ~15% damage tolerance, which is worth
# having on a printed poster that gets scuffed — but this is a clean pixel
# render on a screen, where there is no damage to tolerate. What it costs is
# modules: this URL is 33x33 at M and 29x29 at L, and module size is the only
# thing that decides whether a phone camera a metre away resolves the code.
# Trading damage tolerance nobody needs for 14% bigger squares is the right
# way round here.
qr = segno.make(url, error="l")
# Dark modules on a light ground, the way the spec describes and the way
# every scanner is written to expect. The first version was cream modules on
# a dark panel, which looked better against the sky and is an INVERTED code:
# plenty of readers, including some phone cameras, simply will not resolve
# one. A donation path that quietly fails for a share of people is worse
# than one that looks slightly less at home on the background.
#
# border=3 bakes the quiet zone into the image, so it scales with the code
# and cannot be squeezed by a CSS change later. The spec asks for 4; 3 plus
# the tile's own rounding is comfortable in practice and buys back module
# size, which is what decides whether a camera resolves it at all.
qr.save(
    FOLDER / "donate-qr.svg",
    scale=1,
    border=3,
    dark="#000000",     # true black
    light="#FFFFFF",    # true white
)
# Black on white, not brand maroon on cream. The branded version measured
# about 13:1 instead of 21:1, and at the size this renders on a tablet —
# roughly three screen pixels per module — the anti-aliased edge of every
# module carried enough of the cream into the maroon to make the whole code
# look smudged. A QR is not a place to spend brand colour: the only thing it
# has to do is resolve under a phone camera held at arm's length.

# segno writes width/height and no viewBox, which means CSS can stretch the
# element without scaling the artwork — the code ends up a few pixels wide in
# the corner of its box, which is exactly what happened the first time. Give
# it a viewBox so it scales to whatever the page asks for.
out = FOLDER / "donate-qr.svg"
markup = out.read_text(encoding="utf-8")
if "viewBox" not in markup:
    # The SAME border the image was saved with. This read border=2 while the
    # save above used border=3, so a 35-unit drawing was mapped into a
    # 33-unit box: the browser scaled it up and clipped two modules off the
    # right and bottom, which is the entire quiet zone on those two sides.
    # A cropped quiet zone is a code some scanners refuse and all of them
    # resolve more slowly, and on screen it reads as a code that has been
    # cut off.
    size = qr.symbol_size(scale=1, border=3)[0]
    markup = markup.replace(
        '<svg xmlns="http://www.w3.org/2000/svg"',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d"' % (size, size),
        1,
    )
    out.write_text(markup, encoding="utf-8")

(FOLDER / "donate-qr.url").write_text(url + "\n", encoding="utf-8")
print("donate-qr.svg written for %s (version %s, %d modules)"
      % (url, qr.version, qr.symbol_size(scale=1, border=0)[0]))
