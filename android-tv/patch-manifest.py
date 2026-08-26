#!/usr/bin/env python3
"""Patch a Bubblewrap-generated AndroidManifest.xml for TV launchers.

Bubblewrap builds a phone app. Three things have to be added by hand for a
sideloaded app to be usable on Fire TV or Android TV, none of which Bubblewrap
or PWABuilder expose as an option:

  1. LEANBACK_LAUNCHER on the launcher activity. Without it the app installs
     and then never appears on the TV home screen — the single most confusing
     failure mode, because everything reports success.
  2. android:banner on <application>. TV launchers show a 16:9 banner, not the
     icon, and have nothing to draw without it.
  3. uses-feature entries marking leanback and touchscreen as not required.
     A TV has no touchscreen; without this some launchers filter the app out
     and Play won't list it on TV at all.

Idempotent: running it twice is a no-op, so a re-run of the workflow that
resumes mid-way can't double-insert.

    python3 android-tv/patch-manifest.py <path-to-AndroidManifest.xml>
"""

import re
import sys

LEANBACK = '<category android:name="android.intent.category.LEANBACK_LAUNCHER" />'
FEATURES = (
    '    <uses-feature android:name="android.software.leanback" android:required="false" />\n'
    '    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n'
)


def patch(text):
    changed = []

    # 1. LEANBACK_LAUNCHER next to every LAUNCHER category.
    if "LEANBACK_LAUNCHER" not in text:
        launcher = re.search(
            r'([ \t]*)<category android:name="android\.intent\.category\.LAUNCHER"\s*/>', text)
        if not launcher:
            raise SystemExit("FAIL: no LAUNCHER category found — manifest layout changed?")
        indent = launcher.group(1)
        text = text.replace(launcher.group(0), launcher.group(0) + "\n" + indent + LEANBACK, 1)
        changed.append("LEANBACK_LAUNCHER category")

    # 2. banner on <application>.
    if "android:banner" not in text:
        app = re.search(r"<application\b", text)
        if not app:
            raise SystemExit("FAIL: no <application> element found")
        text = text[:app.end()] + '\n        android:banner="@drawable/banner"' + text[app.end():]
        changed.append("android:banner")

    # 3. uses-feature declarations.
    if "android.software.leanback" not in text:
        manifest = re.search(r"<manifest\b[^>]*>\n", text)
        if not manifest:
            raise SystemExit("FAIL: no <manifest> opening tag found")
        text = text[:manifest.end()] + FEATURES + text[manifest.end():]
        changed.append("uses-feature leanback + touchscreen")

    return text, changed


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        original = f.read()

    text, changed = patch(original)

    if not changed:
        print("  already patched, nothing to do")
        return

    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    for c in changed:
        print(f"  added {c}")

    # Fail loudly rather than shipping a package that silently isn't a TV app.
    for needle in ("LEANBACK_LAUNCHER", "android:banner", "android.software.leanback"):
        if needle not in text:
            raise SystemExit(f"FAIL: {needle} missing after patching")


if __name__ == "__main__":
    main()
