#!/usr/bin/env python3
"""Regenerate the donation QR from the URL in data/newbuild.json.

Run this whenever the donation link changes:

    pip install segno
    python3 tools/make-qr.py

It writes donate-qr.svg and donate-qr.url. build.py refuses to build if
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

ROOT = pathlib.Path(__file__).resolve().parent.parent
give = json.loads((ROOT / "data" / "newbuild.json").read_text(encoding="utf-8"))["give"]
url = give.get("qrUrl") or give["otherAmountUrl"]

# Error correction L, not M. M buys ~15% damage tolerance, which is worth
# having on a printed poster that gets scuffed — but this is a clean pixel
# render on a screen, where there is no damage to tolerate. What it costs is
# modules: this URL is 33x33 at M and 29x29 at L, and module size is the only
# thing that decides whether a phone camera a metre away resolves the code.
# Trading damage tolerance nobody needs for 14% bigger squares is the right
# way round here.
qr = segno.make(url, error="l")
qr.save(
    ROOT / "donate-qr.svg",
    scale=1,
    border=2,
    dark="#F7F3EA",     # cream on transparent: this sits on the dark sky
    light=None,
)

# segno writes width/height and no viewBox, which means CSS can stretch the
# element without scaling the artwork — the code ends up a few pixels wide in
# the corner of its box, which is exactly what happened the first time. Give
# it a viewBox so it scales to whatever the page asks for.
out = ROOT / "donate-qr.svg"
markup = out.read_text(encoding="utf-8")
if "viewBox" not in markup:
    size = qr.symbol_size(scale=1, border=2)[0]
    markup = markup.replace(
        '<svg xmlns="http://www.w3.org/2000/svg"',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d"' % (size, size),
        1,
    )
    out.write_text(markup, encoding="utf-8")

(ROOT / "donate-qr.url").write_text(url + "\n", encoding="utf-8")
print("donate-qr.svg written for %s (version %s, %d modules)"
      % (url, qr.version, qr.symbol_size(scale=1, border=0)[0]))
