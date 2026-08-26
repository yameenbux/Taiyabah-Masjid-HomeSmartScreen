# Getting this onto an Android TV

Everything here needs a **desktop with Android Studio**. There is no iPad route — the signing
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
