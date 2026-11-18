# How many homes the live stream can actually serve

The tablets are the easy half. At 200+ homes the **stream** is what decides whether this ships, and
it needs settling before you commit to a unit count.

## The numbers, from this repo's own config

`data/stream.json` opens the stream 3 minutes before each adhan and closes it 25 minutes after
jamā'ah — a 28-minute window per prayer, with Jumu'ah running to 73 minutes for the khutbah. That is
**146 minutes a day on average, or 2.44 hours**. At the current 128 kbps that is 57.6 MB/hour.

| | 128 kbps (now) | 64 kbps |
| --- | --- | --- |
| Per home, auto-tune only | **4.3 GB/month** | 2.1 GB/month |
| Per home, radio left on 24/7 | 42.1 GB/month | 21.0 GB/month |
| 200 homes, all auto-tune | 0.86 TB/month | 0.43 TB/month |
| 200 homes, 10% leave it on | 1.61 TB/month | 0.81 TB/month |
| 200 homes, 25% leave it on | **2.75 TB/month** | 1.37 TB/month |
| 500 homes, all auto-tune | 2.14 TB/month | 1.07 TB/month |
| 500 homes, 25% leave it on | 6.86 TB/month | 3.43 TB/month |

> I told you 5.5 GB/home and 1.1 TB at 200 homes earlier in this conversation. Both were too high —
> I'd assumed 40-minute windows and the config uses 28. The corrected figures are above.

Two things fall out of that table.

**"Leave the radio on" is a 10× multiplier.** One household that leaves it running all day costs as
much as ten that let auto-tune do its thing. At 200 homes, a quarter of them doing it more than triples
your bill. That feature is free at 20 homes and expensive at 200 — decide whether to keep it, cap it,
or price it.

**Halving the bitrate halves everything.** For one muadhin's voice, 64 kbps is indistinguishable from
128. This is the cheapest single win available and it costs you nothing but asking your host for a
second mount.

## The harder problem: they all connect at once

Bandwidth is a bill. **Concurrency is a wall.** All 200 homes open the stream inside the same sixty
seconds, five times a day, because auto-tune fires off the same timetable on every device. A classic
Shoutcast or Icecast mount allocates a listener slot per connection, so you need 200 slots for
200 homes — there is no averaging to hide behind. That cap, not your bandwidth allowance, is what
actually stops you adding the 201st home.

## What to do about it

**First, ask radioca.st two questions:** what is the concurrent-listener cap on your plan, and do they
offer an **HLS** mount? Everything below depends on the answers and neither is on their public pages.

**If they offer HLS, take it.** HLS chops the stream into short cacheable files instead of holding a
socket open per listener. A CDN serves those files, the origin serves one copy, and concurrency stops
being a cap at all — it scales to thousands without a plan change. Several competitors
([cloudrad.io](https://www.cloudrad.io/pricing), [Zeno.FM](https://help.zeno.fm/en/article/plans-and-pricing-2025-6f0z0h),
[Radiomast](https://radiomast.io/pricing)) advertise HLS with CDN scaling on flat plans in the
$12–39/month range, which at 200+ slots is dramatically cheaper than per-slot Shoutcast hosting. If
radioca.st won't do HLS, moving host is a smaller job than engineering around it.

**If you'd rather own it:** pull the Icecast mount through ffmpeg into HLS segments and put them on
**Cloudflare R2**, which charges **nothing for egress regardless of volume**. Cloudflare's terms
explicitly permit serving media through their CDN when it's hosted on an R2 — the old restriction only
covers content hosted elsewhere. That makes even 7 TB/month essentially free, at the cost of running
one small transcoder. Worth it at 500 homes; probably over-engineering at 200 if your host will just
give you HLS.

**The trade-off to know about:** HLS adds latency — typically 10–30 seconds against about 1.2 seconds
for the current MP3 mount. For households beyond earshot of the masjid that is irrelevant. For a
household close enough to hear the real adhan through an open window, the echo would be odd. Worth a
moment's thought, not a blocker.

## The app change this needs

The player currently points `audio-live` at an MP3 URL, which browsers handle natively. **HLS needs
`hls.js`** on Chrome and Android WebView; Safari plays it natively. That is a contained change — add
the library, detect native support, keep the MP3 mount as the fallback — but it is not zero, and it
wants doing *after* you know which stream you're pointing at, not before.

## Suggested order

1. Ask radioca.st for the concurrent cap and whether HLS is available.
2. Ask for a **64 kbps** mount regardless. It halves the bill either way.
3. Decide whether "leave it on all day" survives at 200 homes.
4. Once the stream shape is settled, add `hls.js` to the player.
5. Only then commit to a hardware order.
