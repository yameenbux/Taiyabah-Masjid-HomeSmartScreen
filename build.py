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

import json
import pathlib

ROOT = pathlib.Path(__file__).parent

SOURCES = {
    "__TIMETABLE_JSON__": "data/timetable-2026.json",
    "__NEWBUILD_JSON__": "data/newbuild.json",
    "__OCCASIONS_JSON__": "data/occasions.json",
}


def main():
    out = (ROOT / "template.html").read_text(encoding="utf-8")

    for placeholder, relpath in SOURCES.items():
        blob = json.loads((ROOT / relpath).read_text(encoding="utf-8"))
        out = out.replace(
            placeholder,
            json.dumps(blob, separators=(",", ":"), ensure_ascii=False),
        )

    for placeholder in SOURCES:
        assert placeholder not in out, "%s was not substituted" % placeholder

    (ROOT / "index.html").write_text(out, encoding="utf-8")
    print("index.html written (%d bytes)" % len(out.encode("utf-8")))


if __name__ == "__main__":
    main()
