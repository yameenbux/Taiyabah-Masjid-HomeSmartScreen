# Home screen design concepts

Three directions for the home screen, put to the masjid on 16 November 2026 and
**not yet chosen**. Open any of them straight in a browser — they are standalone
pages with Monday 16 November's times hardcoded and no logic behind them. None of
this is wired to the timetable, the countdown does not count, and nothing here is
built or served. The live screen is `index.html`, built from `template.html`.

They exist because a first set of three "concepts" was rejected for all looking
the same — and it was right. That set kept one composition (centred countdown on
a maroon gradient, six-time strip, three cards) and varied only the widget in the
middle: a line, a circle, a box. Concepts have to differ in ground, structure,
typography and density or they are one design shown three times.

| | ground | structure | type | density |
|---|---|---|---|---|
| `d1-horizon` | full-bleed photograph | anchored lower-left, no boxes at all | Fraunces thin, wide tracking | 4 elements |
| `d2-mihrab`  | cream | centred, symmetrical, arch | Fraunces + Amiri as ink on paper | 6 elements |
| `d3-board`   | near-black | strict grid, edge to edge | Hanken Grotesk only, no serif | everything at once |

Notes worth keeping if one of these is taken forward:

- **`d2-mihrab` is the light one.** Gold `#C6A24C` is 2.15:1 on cream and fails as
  text, so anything small is bronze `#7A5A12` (5.65:1) and real gold is only ever
  a hairline. Do not "restore the brand gold" on this one without re-measuring.
- **`d2-mihrab`'s arch is an absolutely positioned SVG.** Its children need
  `position:relative` or the arch's 62% white fill paints over the countdown and
  washes the whole centre out. That bug shipped into the first screenshot.
- **`d1-horizon` deliberately barely scrims the photograph** — the shade is a
  wedge up from the bottom-left corner, placed only where type sits. If it is
  taken forward, every text zone needs measuring against the lightest pixel
  underneath it on all four skies, the way `index.html` already is.
