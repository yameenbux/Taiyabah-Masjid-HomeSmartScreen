# Running a screen on a Windows mini PC (ThinkCentre Tiny)

For the masjid's wall displays: a small PC per screen, Chrome in kiosk mode on the live site, and
Tailscale for remote access. This replaces the Fire TV route entirely — no APK, no signing key, no
Digital Asset Links, no Amazon home screen. If you're doing this, you can ignore
[`android-tv.md`](android-tv.md) completely.

The prayer content still updates from the web on its own. Nothing below needs redoing when the app
changes — you're only setting up the machine.

> **Windows caveat, stated once.** Windows will reboot itself for updates unless told otherwise, and a
> reboot mid-Jumu'ah is the failure this whole document exists to prevent. Step 5 is not optional.
> Everything else here is ordinary kiosk setup.

## Before you start

Check **Settings → System → About → Windows specifications → Edition**:

- **Windows Pro** — you get Remote Desktop, which is the nicest remote access. Recommended.
- **Windows Home** — no Remote Desktop *host*. Use RustDesk or AnyDesk instead (step 7); everything else
  is identical.

## 1. BIOS: come back on after a power cut

The single most valuable setting, and it's easy to forget. Power the machine on, press **F1** for BIOS →
**Power** → **After Power Loss** → **Power On**.

Without this, a brief outage leaves three dark screens until somebody walks round with a keyboard.

While you're there, set the machine to boot straight to Windows (no boot menu delay).

## 2. Auto-login

The kiosk must reach the desktop with nobody typing a password.

```
Win+R  →  netplwiz  →  untick "Users must enter a user name and password"  →  Apply
```

It then asks for the password once, to store it.

> This means anyone with physical access to the PC is logged in as that user. For a machine bolted
> behind a wall-mounted TV that's a reasonable trade, but use a **dedicated local account** with no
> access to anything else — not a Microsoft account, and not an account with the masjid's email signed in.

## 3. Never sleep, never blank, no screensaver

```powershell
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
powercfg /change disk-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

Then **Settings → Personalisation → Lock screen → Screen saver** → *(None)*, and untick "On resume,
display logon screen".

Also **Settings → Accounts → Sign-in options → If you've been away, when should Windows require you to
sign in again?** → **Never**.

## 4. Chrome in kiosk mode

Install Chrome. Create a shortcut with these flags — the target, in one line:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-features=TranslateUI --check-for-update-interval=604800 --autoplay-policy=no-user-gesture-required --user-data-dir="C:\kiosk-profile" https://yameenbux.github.io/Taiyabah-Masjid-HomeSmartScreen/
```

What each one is for:

| Flag | Why |
| --- | --- |
| `--kiosk` | True fullscreen, no address bar, no tabs |
| `--autoplay-policy=no-user-gesture-required` | **The Adhan plays with nobody pressing anything.** Without this the sound pill sits amber waiting for a click that will never come |
| `--disable-session-crashed-bubble` | After a power cut Chrome otherwise shows "Restore pages?" over the display and waits |
| `--noerrdialogs`, `--disable-infobars` | No popups over a wall screen |
| `--user-data-dir` | A dedicated profile, so nothing else on the machine disturbs it |

**Using Edge instead?** It works, but add `--edge-kiosk-type=fullscreen --kiosk-idle-timeout-minutes=0`.
Edge's kiosk mode resets the session after idle by default, which on a display nobody touches means it
resets constantly.

## 5. Stop Windows rebooting itself

**Settings → Windows Update → Advanced options → Active hours** → set **manually** to the widest range
allowed (18 hours), e.g. **04:00 to 22:00**. Updates then install outside that window.

On **Pro**, also set the policy that prevents a reboot while someone is logged in:

```
Win+R → gpedit.msc
Computer Configuration → Administrative Templates → Windows Components → Windows Update
  → "No auto-restart with logged on users for scheduled automatic updates installations" → Enabled
```

Combined with auto-login, the machine is always "logged in", so Windows waits for you rather than
rebooting during Fajr. **You then have to reboot them yourself occasionally** — which is what the remote
access in step 7 is for. Once a month over Tailscale is fine.

## 6. Start on boot, and restart if it closes

Task Scheduler is better than the Startup folder here, because it can restart the browser if it dies.

```
Task Scheduler → Create Task
  General:  "Taiyabah Kiosk", Run only when user is logged on
  Triggers: At log on (of your kiosk user), Delay task for: 30 seconds
  Actions:  Start a program → the chrome.exe path and flags from step 4
  Conditions: untick "Start the task only if the computer is on AC power"
  Settings: tick "If the task fails, restart every: 1 minute", up to 3 times
```

The 30-second delay matters — it gives the network time to come up, so the first load isn't an error page.

For a belt-and-braces watchdog, add a second task on a 5-minute repeat running:

```powershell
if (-not (Get-Process chrome -ErrorAction SilentlyContinue)) { Start-ScheduledTask -TaskName "Taiyabah Kiosk" }
```

## 7. Remote access

Install **Tailscale** on each PC and sign in with the masjid's account (see the warning below). Each
machine gets a fixed address reachable from anywhere, with no port forwarding and no firewall changes.

- **Windows Pro** — enable **Settings → System → Remote Desktop**, then connect to the machine's
  Tailscale address with Remote Desktop from your laptop or iPad.
- **Windows Home** — install **RustDesk** (free, self-hostable) or **AnyDesk** and connect over Tailscale.

> **Use a masjid account, not your personal one.** Tailscale's free tier covers this easily either way,
> but if the tailnet is on your personal login, the charity loses access to its own screens the day you
> step back. Create something like `tech@taiyabahmasjid.com` and use that for Tailscale, the Google
> account on the PCs, and anything else these machines depend on. Same reasoning as keeping the signing
> keystore somewhere the charity can reach.

Name the machines in Tailscale after where they are — `masjid-mainhall`, `masjid-foyer`,
`masjid-ladies` — so "screen two is frozen" maps to something without guessing.

## 8. Set the TV up too

- **Picture mode: Standard or Movie**, not Vivid or Dynamic. Vivid renders the brand maroon as bright
  magenta.
- **Aspect: Just Scan / Screen Fit / 1:1**, not a zoom mode. The dashboard already reserves a 5%
  overscan margin, but a TV set to zoom will still crop.
- If the TV has a **HDMI-CEC** or "auto power on with source" setting, turn it on so the TV wakes with
  the PC after an outage.
- Turn off the TV's own sleep timer / "no signal" auto-off.

## 9. Check it works

Leave one screen running through a prayer time you'll be present for — Zuhr or Asr, not Fajr — and
confirm the Adhan sounds with nobody touching anything. That's the test none of the setup above can
substitute for.

To read the app's own diagnostics, press **F12** for DevTools (or connect remotely and do it) and look at
the Console:

- `[taiyabah] device timezone …` — printed every load. Times are corrected to Bolton regardless, but a
  large correction means that PC's clock is set wrong.
- `[taiyabah] timers were suspended for ~Ns` — the machine slept. Revisit step 3.
- `[taiyabah] autoplay permitted …` — audio enabled itself. If this is missing and the pill is amber, the
  `--autoplay-policy` flag isn't reaching Chrome; check the shortcut target.

## Recovery, when a screen misbehaves

| Symptom | Fix |
| --- | --- |
| Blank or frozen page | Remote in, close Chrome; the watchdog restarts it within 5 minutes |
| Amber "Sound paused" pill | The autoplay flag is missing — check the shortcut, restart Chrome |
| Wrong prayer times | Check the machine's timezone and clock; the console line above tells you |
| Chrome shows "Restore pages?" | `--disable-session-crashed-bubble` is missing from the shortcut |
| Screen went to sleep | Step 3, and check the TV's own sleep timer |
| Nothing after a power cut | BIOS "After Power Loss" (step 1) wasn't set |
