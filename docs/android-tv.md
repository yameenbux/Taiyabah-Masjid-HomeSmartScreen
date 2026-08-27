# Getting this onto a TV (Fire TV / Android TV)

> **Is a small PC an option?** If you can put a mini PC behind each screen, Chrome in kiosk mode does
> this job with no APK, no signing key, no Digital Asset Links and no Amazon home screen — see
> [`kiosk-windows.md`](kiosk-windows.md). Everything below exists because a streaming stick can't.

## The short way: run the build in CI

`.github/workflows/android-tv-apk.yml` does all of this on a GitHub runner — no desktop, no Android
Studio, no local SDK. **Actions → Build TV APK → Run workflow.** It publishes a signed APK as a GitHub
Release, and that Release URL is what you type into the **Downloader** app on the stick.

Because the app is a WebView wrapping the live site, you almost never rebuild: prayer times, audio fixes
and layout changes reach the stick on their own. Rebuild only when the app *shell* changes — name, icon,
banner, package id, or the TV manifest patches.

Two files drive it, both checked in so the config is reviewable rather than buried in YAML:

- `android-tv/twa-manifest.json` — the Bubblewrap config. **`fallbackType` must stay `webview`**: Fire OS
  ships no Chrome, and a Custom Tabs TWA would open blank on the stick.
- `android-tv/patch-manifest.py` — adds the three things no generator exposes (`LEANBACK_LAUNCHER`,
  `android:banner`, and the leanback/touchscreen `uses-feature` entries). Idempotent, and verified against
  real Bubblewrap output.

**Signing.** With no secrets set, the workflow generates a throwaway key so the first build is installable
immediately — but a later build then can't upgrade that install in place, you'd have to uninstall first.
The key is never uploaded anywhere (this repo is public, and Actions artifacts on a public repo are
downloadable by anyone). For stable upgrades, generate a keystore once and add `ANDROID_KEYSTORE_BASE64`
(base64 of the .keystore file), `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD` as repository
secrets.

**Fire OS check first.** Fire TV models from 2025 onward may run **Vega OS**, which is not Android and
runs no APKs at all. Settings → My Fire TV → About. Fire OS 7 (Android 9) and Fire OS 8 (Android 11) are
both fine.

---

## Running it on the mosque's sticks

### Installing — the URL to type into Downloader

Use the **`latest`** URL, not the one from a specific build. It always points at the newest APK, so it
never changes and you can write it on a card by the screens:

```
https://github.com/yameenbux/Taiyabah-Masjid-HomeSmartScreen/releases/latest/download/taiyabah-tv.apk
```

On each stick, once:

1. Settings → My Fire TV → **About** → confirm it says Fire OS 7 or 8 (Vega OS can't run this at all).
2. Settings → My Fire TV → Developer Options → **Apps from Unknown Sources** → on.
   If Developer Options isn't listed, go to About and click the device name seven times.
3. Install **Downloader** from the Amazon Appstore, open it, enter the URL above, install.
4. The app appears under **Your Apps & Channels**. Long-press it to move it to the front row.
5. Open it and press **OK** on the sound pill — it takes focus on load, so it's where the remote lands.
   It must read "Sound on · tap to test" before you walk away.

Step 5 is per install and per device: browsers refuse to play audio without one real interaction, and
nothing can remove that requirement.

### Booting straight into it, and never showing the Fire TV menu

A masjid wall display shouldn't drop to Amazon's home screen — it merchandises films and trailers. Two
levels of fix, and they are not equally safe.

**Level 1 — autostart helper (reversible, recommended first).** Install an autostart app from the
Appstore (search "autostart" / "launch on boot") and point it at Taiyabah Home. The stick then opens the
app after every reboot. Amazon's launcher stays the home screen, so pressing **Home** still reaches it —
fine when the remote lives in a drawer, and it leaves every recovery route intact. Try this first.

A boot-completed receiver in the app itself would do the same job, but only on Fire OS 7 (Android 9);
Android 10 onwards blocks starting an activity from the background, so it would quietly stop working on
Fire OS 8. That's why it isn't built in.

**Level 2 — kiosk mode (the real fix, and a one-way door).** Run the workflow with the **kiosk** input
ticked. The app then registers as a HOME screen: the stick boots into it and the Home button returns to
it, so the Fire TV menu is never reachable.

> **Read this before ticking it.** With no other launcher installed there is **no on-screen route back to
> Fire TV Settings**. If the app crashes or you need to change a device setting, the only ways back are:
>
> ```bash
> adb connect <stick-ip>:5555
> adb shell cmd package set-home-activity com.amazon.tv.launcher   # hand Home back to Amazon
> adb uninstall com.taiyabahmasjid.homescreen                      # or remove the app entirely
> ```
>
> **Set up adb access and confirm it works before deploying a kiosk build**, not after. Enable it at
> Settings → My Fire TV → Developer Options → ADB debugging while you still can, and write the stick's IP
> down. Failing that, a factory reset is the fallback.

Kiosk builds are tagged `tv-build-N-kiosk` so they're distinguishable from standard ones, and the job
summary repeats the recovery commands.

**Fire OS may not honour it.** Amazon is restrictive about third-party launchers and behaviour differs by
device and Fire OS version. Untested here — if the stick ignores the HOME category you'll simply get the
standard behaviour back, which is a safe failure. Test on one stick before doing all of them.

### The URL bar across the top of the app

If the installed app shows a close button and `yameenbux.github.io` along the top, that is the **Custom
Tabs toolbar**, and it means Android could not verify that this app owns that site.

`fallbackType: webview` does not prevent it. That fallback only runs when *no* Custom Tabs provider
exists — and Fire OS's Silk **does** provide Custom Tabs, so the TWA path is taken and the WebView is
never reached. (`WebViewFallbackActivity` genuinely has no toolbar: it calls `setContentView(mWebView)`
with nothing above it. It also can't be made the launcher directly, because it requires a `LAUNCH_URL`
extra and would crash without one.)

So on Fire TV, **asset links are what remove the bar** — they are not optional:

1. Every build writes an `assetlinks.json` carrying the fingerprint of the key that signed it. It's
   attached to the Release next to the APK, uploaded as an artifact, and printed in the job summary.
2. Create a repo named **exactly** `yameenbux.github.io`, enable Pages on it, and put that file at
   `.well-known/assetlinks.json`, so it serves from
   `https://yameenbux.github.io/.well-known/assetlinks.json`.
3. Force-stop and reopen the app. The bar should be gone.

> **Set the keystore secrets first.** Without `ANDROID_KEYSTORE_BASE64` the build signs with a throwaway
> key, so the fingerprint — and therefore this file — changes on every build and the bar returns each
> time. Setting a stable key once makes this a one-off job.

A custom domain (`home.taiyabahmasjid.com`) would avoid the separate repo entirely, since `.well-known/`
would then sit at a root you control.

### Stopping it sleeping

The app holds a Screen Wake Lock and plays a near-silent audio loop (which makes the OS treat it as
active media). Neither can override the device's own settings, so on every stick:

- Settings → Display & Sounds → **Screensaver** → Start after → longest available / off.
- Settings → My Fire TV → **Sleep** → set as long as it allows, or Never if offered.
- The TV itself must stay on and unmuted, on the right HDMI input. **The Adhan cannot sound through a TV
  that is off** — for Fajr that means leaving the screens powered overnight.

Wake Lock support inside a WebView is less certain than in Chrome. The audio keep-alive is the more
reliable of the two mechanisms here, which is another reason step 5 above is not optional.

### Managing them remotely

Most changes need no visit and no rebuild. The app is a WebView pointed at the live site, so **anything
that ships to `main` reaches every stick on its own** — prayer times, layout, audio timing, bug fixes.
`sw.js` is network-first for the page, and there's a daily reload just after 2am, so a stick left running
picks changes up within 24 hours without anyone touching it.

Only the app *shell* needs a rebuild and reinstall: name, icon, banner, package id, or the TV manifest
patches. That's the "Build TV APK" workflow again.

For hands-on access, Fire TV supports ADB over the local network — Settings → My Fire TV → Developer
Options → **ADB debugging**, then `adb connect <stick-ip>:5555`. That needs to be on the same network as
the sticks, so it's for someone at the masjid, not genuinely remote. `adb logcat | grep taiyabah` will
show the app's own diagnostics, including the timezone line and any timer-suspension warnings.

### If a screen looks wrong

The app logs its own health at boot and when it misbehaves. Over ADB:

- `[taiyabah] device timezone <zone>; showing Europe/London (correcting by N min)` — printed every boot.
  Times are corrected regardless, so this is diagnostic rather than a fault, but a large N means that
  stick's clock is misconfigured and worth fixing.
- `[taiyabah] timers were suspended for ~Ns — catching up` — the device slept. Check the settings above.
- Sound pill amber and reading "Sound paused · tap to resume" — audio output is blocked and the Adhan
  will not play. Press OK on it.

---

## The long way: build it by hand

Everything below needs a **desktop with Android Studio**. There is no iPad route — the signing
step alone rules it out. Budget an hour the first time; after that, content changes reach the TV on
their own (the app is a thin wrapper around the live URL) and you only rebuild for the app shell.

Before starting, be sure you actually need this. **Tablets don't** — Chrome's *Install app* gives a
fullscreen PWA with no address bar and no build step. Android TV has no equivalent, which is the only
reason this document exists.

## What's wrong with a stock PWABuilder package

These were read out of a real PWABuilder download (`AndroidManifest.xml` and `resources.arsc`), not
assumed. All four must be fixed or the app is useless on a TV:

| Problem | Symptom on the TV |
| --- | --- |
| Unsigned, `targetSdk 36` | Won't install. v1/`jarsigner` signing is not enough — targetSdk ≥ 30 requires APK Signature Scheme v2+ |
| `fallbackType` = `customtabs` | Android TV ships no Chrome, so there's no Custom Tabs provider and the app opens blank |
| No `LEANBACK_LAUNCHER` category | Installs, but never appears on the TV home screen |
| No `android:banner`, no `uses-feature` | Launcher has no artwork; touchscreen isn't marked optional |

The good news on the second one: `WebViewFallbackActivity` is **already bundled in the dex**. The
WebView renderer is present and merely unselected — it's a config value, not missing code.

## 1. Get a package that includes the source project

On pwabuilder.com, package for Android. Two settings matter:

- **Package ID** must be `com.taiyabahmasjid.homescreen`. Not the `io.github.<user>.twa` default. This
  is permanent once published to Play.
- **Fallback behaviour** → **WebView**, under All Settings. Setting it here saves editing
  `strings.xml` later.

That settings panel is a long scrolling form and renders badly in mobile Safari — use a desktop
browser. The download should contain `build.gradle`, `gradlew` and a `app/` directory. If all you get
is `*-unsigned.apk` / `*-unsigned.aab` and a `Readme.html`, you have the unsigned output and the
signing option still needs finding.

## 2. Edit the manifest for TV

Open the project in Android Studio. In `app/src/main/AndroidManifest.xml`:

```xml
<!-- Inside <manifest>, alongside any existing uses-* entries. -->
<uses-feature android:name="android.software.leanback"      android:required="false" />
<uses-feature android:name="android.hardware.touchscreen"   android:required="false" />
```

`touchscreen required="false"` is not optional — Play won't list the app on TV without it, and some
launchers filter on it.

```xml
<!-- On <application>, so the TV home row has artwork to show. -->
<application
    android:banner="@drawable/banner"
    ... >
```

```xml
<!-- In LauncherActivity's existing <intent-filter>, next to the LAUNCHER category. -->
<category android:name="android.intent.category.LEANBACK_LAUNCHER" />
```

Then copy the banners from this repo (regenerate with `python3 android-tv/make-banners.py` if they're
missing):

```
android-tv/banner-xhdpi-320x180.png    →  app/src/main/res/drawable-xhdpi/banner.png
android-tv/banner-xxhdpi-480x270.png   →  app/src/main/res/drawable-xxhdpi/banner.png
android-tv/banner-xxxhdpi-640x360.png  →  app/src/main/res/drawable-xxxhdpi/banner.png
```

If you didn't set the fallback in step 1: in `app/src/main/res/values/strings.xml`, find the string
resource named `fallbackType` whose value is `customtabs` and change it to `webview`.

## 3. Create a signing key — once, and keep it

```bash
keytool -genkeypair -v \
  -keystore taiyabah-release.keystore \
  -alias taiyabah -keyalg RSA -keysize 2048 -validity 10000
```

**Back up `taiyabah-release.keystore` and its passwords somewhere permanent, and never commit them to
this public repo.** Lose the key and the app can never be updated — a sideloaded install signed with a
different key has to be uninstalled first. Leak it and someone else can ship updates as you.

## 4. Build and sign

Easiest is Android Studio: *Build → Generate Signed Bundle / APK → APK*, pick the keystore, choose the
`release` variant. From the command line instead:

```bash
./gradlew assembleRelease
# apksigner and zipalign live in $ANDROID_HOME/build-tools/<version>/
zipalign -v -p 4 app/build/outputs/apk/release/app-release-unsigned.apk aligned.apk
apksigner sign --ks taiyabah-release.keystore --out taiyabah-tv.apk aligned.apk
apksigner verify --print-certs taiyabah-tv.apk     # must report v2 (or higher) as true
```

That last line is the check that matters. A package that only verifies v1 will not install on the TV.

## 5. Asset links, or live with the address bar

Digital Asset Links are checked **per-origin, not per-path**. The site lives at
`yameenbux.github.io/Taiyabah-Masjid-HomeSmartScreen/`, so the file has to sit at the root of the
domain — which means a separate repo literally named `yameenbux.github.io`, serving:

```
https://yameenbux.github.io/.well-known/assetlinks.json
```

Get the fingerprint from the key you just made:

```bash
keytool -list -v -keystore taiyabah-release.keystore -alias taiyabah | grep -A1 SHA256
```

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.taiyabahmasjid.homescreen",
    "sha256_cert_fingerprints": ["PASTE:THE:SHA256:FINGERPRINT:HERE"]
  }
}]
```

Skipping this leaves Chrome's address bar visible in the app, and on newer Chrome it can crash on
launch instead. **The proper fix is a custom domain** — put the dashboard on
`home.taiyabahmasjid.com` and `.well-known/` becomes controllable at that origin's root.

If you later publish through Google Play, note that **Play re-signs the app**, so this fingerprint
stops being the one Android checks. After uploading, go to Play Console → Setup → App integrity, copy
the SHA-256 there, and add it to the array alongside the original.

## 6. Install it on the TV

1. On the TV: Settings → System → About, click **Build** seven times to unlock Developer options.
2. Settings → System → Developer options → allow **apps from unknown sources**.
3. Install **Downloader** (AFTVnews) from the Play Store on the TV.
4. Put `taiyabah-tv.apk` somewhere fetchable over HTTPS, enter that URL in Downloader, install.

With `adb` on the same network, `adb connect <tv-ip>:5555 && adb install taiyabah-tv.apk` also works.

## 7. Make it behave as an always-on display

The app can't override these — they're device settings:

- Settings → Device Preferences → **Screen saver** → Off / Never.
- Settings → Device Preferences → **Power** → disable any auto-sleep timeout.
- Check the TV's picture settings for **Just Scan / Screen Fit / 1:1** rather than a zoom mode. The
  dashboard already reserves the 5% Android TV overscan margin, but a TV set to zoom will still crop.

**The Adhan only sounds if the TV is on and unmuted.** For Fajr that means leaving it powered
overnight, on the right input, with the volume up. Worth deciding deliberately rather than discovering
it at 5am.

## Known-good facts, so nobody re-derives them

- Package ID in the built manifest: `com.taiyabahmasjid.homescreen`
- Scope: `https://yameenbux.github.io/Taiyabah-Masjid-HomeSmartScreen/`
- `minSdkVersion 23`, `targetSdkVersion 36`
- A local Gradle build needs `dl.google.com`, `repo.maven.apache.org` and `services.gradle.org`.
  Measured from a restricted network: the last two resolve, **`dl.google.com` does not**, and it's the
  one hosting the Android SDK and Gradle plugin. Confirm it's reachable before starting anywhere
  locked down.
