# Torchick — Animated Video Ad (`ad.mp4`)

An elegant, fully original ~30-second vertical (9:16) video ad for **Torchick / תור צ׳יק** —
a Hebrew-first, RTL, mobile-first appointment-booking SaaS for small Israeli service
businesses. Built as a code-driven motion-graphics piece with AI-generated hero visuals,
kinetic Hebrew typography, and an original synthesized music bed.

- **Output:** `ad.mp4` — 1080×1920, 30 fps, ~30 s, H.264 (yuv420p) + AAC.
- **Poster:** `poster.png` — end-card frame.
- **Script/blueprint:** `storyboard.md` (Hebrew, scene-by-scene).

> Inspiration only (no assets/footage/music/narration copied): the competitor MyTor
> tutorial video. Torchick's ad is 100% original.

---

## Why a browser-rendered pipeline?

The single biggest risk was **correct Hebrew RTL glyph shaping** in video. The installed
`ffmpeg` (8.1.1) has **no** `drawtext`/FreeType/HarfBuzz text libraries, so it cannot shape
Hebrew at all. Headless **Chromium** (via Playwright) *does* shape Hebrew perfectly using the
bundled OFL fonts, so the entire ad is authored as a self-contained HTML/CSS/JS animation and
captured frame-by-frame. This guarantees production-grade RTL typography.

---

## Pipeline

```
read brand (repo)  →  storyboard.md  →  AI hero visuals (foundry-image)
     →  ad.html (deterministic timeline)  →  Chromium frame capture (900 PNGs)
     →  music bed (Python wave)  →  ffmpeg encode  →  ad.mp4 + poster.png
```

### 1. Brand
Palette, fonts, voice, and product claims were taken directly from the repo
(`tailwind.config.ts`, `src/components/landing/HeroVisual.tsx`, `src/i18n/he.ts`) — nothing
invented. Navy `#0a182d`→`#24406e`, gold `#cea24a`→`#f2d695`, sand `#faf8f5`.
Display serif = Frank Ruhl Libre; body = Assistant; accents = Rubik/Heebo.

### 2. AI hero visuals — `visuals/`
Generated with the **foundry-image** skill, model **GPT-image-2** (Azure Foundry, Entra auth),
1024×1536, text-free (all text is added as a crisp HTML layer):
`clinic-ambiance.png`, `phone-in-hand.png`, `delighted-owner.png`, `brand-ambiance.png`.

### 3. The animation — `ad.html`
A single self-contained file: a 1080×1920 `dir="rtl"` stage with a deterministic engine
`window.__seek(t)` that positions every element for time `t` synchronously (no wall-clock
animation), which makes frame capture exact and reproducible. Six scenes:

1. Brand open (clinic ambiance + emblem + headline "העסק שלכם מקבל תורים · מסביב לשעון")
2. Problem ("פחות טלפונים, יותר תורים")
3. **Phone booking demo** — a hand-built RTL booking UI: pick a slot → confirm → success
   ("התור נקבע · תזכורת תישלח אוטומטית")
4. Value cards (זימון תורים 24/7 · תזכורות אוטומטיות · יומן חכם · עמוד עסק מעוצב)
5. Promise ("היומן מתמלא. לבד.")
6. End card + CTA ("פתחו עמוד עסק בחינם" · `torchick.duckdns.org`)

### 4. Frame capture — `render/capture.mjs`
Playwright + Chromium, viewport 1080×1920, `deviceScaleFactor: 1`. Waits for
`document.fonts.ready` and image decode, then seeks `t = i/30` for `i = 0..899`, screenshotting
`#stage` to `frames/frame_%05d.png`.

### 5. Music bed — `audio/synth.py`
Original, royalty-clear, synthesized with the Python **stdlib only** (`wave`, `math`, `struct`):
a warm C-major pad progression (Cmaj7–Gadd9–Am7–Fmaj7), a gentle bell arpeggio that lifts under
the CTA, soft sub, master fades, and tanh limiting → `audio/bed.wav` (30.2 s, 44.1 kHz stereo).

### 6. Encode — ffmpeg
```
ffmpeg -y -r 30 -i frames/frame_%05d.png -i audio/bed.wav \
  -c:v libx264 -pix_fmt yuv420p -crf 17 -preset slow -movflags +faststart \
  -c:a aac -b:a 192k -shortest ad.mp4
```
`poster.png` is exported from an end-card frame.

---

## Regenerate from scratch

```bash
cd marketing/video-ad

# (a) music bed
python3 audio/synth.py               # writes audio/bed.wav

# (b) capture frames (Chromium)
cd render && node capture.mjs all     # writes ../frames/frame_%05d.png ; back: cd ..

# (c) encode
ffmpeg -y -r 30 -i frames/frame_%05d.png -i audio/bed.wav \
  -c:v libx264 -pix_fmt yuv420p -crf 17 -preset slow -movflags +faststart \
  -c:a aac -b:a 192k -shortest ad.mp4

# (d) poster
cd render && node capture.mjs test 28.7 ../poster.png
```

Verify a single Hebrew frame before a full run (the RTL gate):
```bash
cd render && node capture.mjs test 13.5 ../test-frame.png   # then view it
```

AI visuals are regenerated via the **foundry-image** skill (see its SKILL.md) with
GPT-image-2 using the prompts recorded in `storyboard.md`.

---

## Files

```
marketing/video-ad/
├── ad.mp4                 # final video (may be gitignored if large)
├── poster.png             # thumbnail / poster frame
├── storyboard.md          # Hebrew scene-by-scene script
├── ad.html                # the entire animation (deterministic __seek timeline)
├── visuals/               # AI hero stills (GPT-image-2, text-free)
├── assets/                # brand emblems + Sean mascot (real brand assets)
├── fonts/                 # OFL Hebrew fonts (Assistant, Frank Ruhl Libre, Heebo, Rubik)
├── audio/synth.py         # music synthesizer  →  audio/bed.wav
├── render/capture.mjs     # Playwright/Chromium frame capture
└── frames/                # generated PNG frames (transient)
```

## Tools & models

| Stage | Tool / model |
|------|--------------|
| Hero visuals | foundry-image skill · **GPT-image-2** (Azure Foundry) |
| Typography/motion | HTML/CSS/JS · OFL Hebrew fonts |
| Frame capture | **Playwright 1.62 + Chromium**, headless |
| Music | Python stdlib `wave` (original synthesis) |
| Encode | **ffmpeg 8.1.1** · libx264 / AAC |

## Truthfulness

All claims were checked against the product code — no invented testimonials, logos, or numbers.
Reminders are shown as "מסרון או דוא״ל" (SMS/email — the product does **not** send WhatsApp
*reminders*; WhatsApp is only used for sharing a business page). No auto-recurring-booking or
"auto waitlist" claims are made. Sean/Gali are Torchick's brand characters, not real customers.

## Fonts / licensing

Hebrew fonts are SIL Open Font License (OFL). The music bed and all motion graphics are original
to this project. AI stills are model-generated and text-free.
