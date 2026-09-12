#!/usr/bin/env python3
# synth.py — original royalty-clear music bed for the Torchick ad.
# Pure stdlib (wave/math/struct). Warm major-key pad + gentle bell arpeggio + soft sub.
# Self-generated => no licensing concerns.
import wave, math, struct

SR = 44100
DUR = 30.2
N = int(SR * DUR)

# --- chord progression (C major, uplifting): Cmaj7 - Gadd9 - Am7 - Fmaj7 ---
BAR = 7.5  # seconds per chord
chords = [
    dict(root=130.81, tones=[261.63, 329.63, 392.00, 493.88]),  # Cmaj7
    dict(root=98.00,  tones=[293.66, 246.94, 392.00, 440.00]),  # Gadd9
    dict(root=110.00, tones=[220.00, 261.63, 329.63, 392.00]),  # Am7
    dict(root=87.31,  tones=[174.61, 261.63, 329.63, 440.00]),  # Fmaj7
]

def chord_at(t):
    idx = int(t // BAR) % len(chords)
    # crossfade weight near the boundary for click-free pad transitions
    local = (t % BAR)
    return idx, local

TWO_PI = 2 * math.pi

def pad_sample(t, ch, detune):
    # sum of gently-voiced sines (fundamental + soft 2nd partial) for each chord tone + root
    s = 0.0
    for f in ch['tones']:
        s += math.sin(TWO_PI * (f + detune) * t) * 0.085
        s += math.sin(TWO_PI * (2 * f + detune) * t) * 0.020
    s += math.sin(TWO_PI * (ch['root'] + detune) * t) * 0.14        # sub
    s += math.sin(TWO_PI * (ch['root'] * 2 + detune) * t) * 0.05
    return s

# --- bell arpeggio: eighth notes, soft exponential-decay plucks ---
EIGHTH = BAR / 8.0
ARP_PATTERN = [0, 2, 1, 3, 2, 3, 1, 2]  # indices into chord tones (upper octave)

def render():
    left = [0.0] * N
    right = [0.0] * N

    # pad (continuous)
    for i in range(N):
        t = i / SR
        idx, local = chord_at(t)
        ch = chords[idx]
        # short crossfade at bar starts
        xf = 1.0
        if local < 0.30:
            xf = local / 0.30
            pidx = (idx - 1) % len(chords)
            pch = chords[pidx]
            left[i]  += pad_sample(t, pch, +0.25) * (1 - xf)
            right[i] += pad_sample(t, pch, -0.25) * (1 - xf)
        left[i]  += pad_sample(t, ch, +0.25) * xf
        right[i] += pad_sample(t, ch, -0.25) * xf

    # arpeggio plucks (additive, scheduled)
    total_eighths = int(DUR / EIGHTH)
    for k in range(total_eighths):
        t0 = k * EIGHTH
        idx, _ = chord_at(t0 + 0.001)
        ch = chords[idx]
        tone = ch['tones'][ARP_PATTERN[k % len(ARP_PATTERN)]] * 2.0  # up an octave => bell
        # gentle swell in/out over the whole piece; brighter near the end card (t>24)
        glob_env = 0.5 + 0.5 * math.sin(TWO_PI * (t0 / DUR) - math.pi / 2)
        amp = 0.11 * (0.6 + 0.4 * glob_env)
        if t0 > 24.0:
            amp *= 1.25  # small lift under the CTA
        dur = 1.1
        ns = int(dur * SR)
        start = int(t0 * SR)
        pan = 0.5 + 0.35 * math.sin(k * 1.7)  # drift across stereo field
        for j in range(ns):
            i = start + j
            if i >= N: break
            tt = j / SR
            env = math.exp(-tt * 3.4) * (1 - math.exp(-tt * 220))  # fast attack, soft decay
            v = (math.sin(TWO_PI * tone * tt) * 0.7
                 + math.sin(TWO_PI * tone * 2 * tt) * 0.18) * env * amp
            left[i]  += v * (1 - pan)
            right[i] += v * pan

    # master envelope: fade in 1.6s, fade out last 3.0s
    fi = int(1.6 * SR); fo = int(3.0 * SR)
    peak = 1e-9
    for i in range(N):
        g = 1.0
        if i < fi: g = i / fi
        if i > N - fo: g = min(g, (N - i) / fo)
        left[i]  *= g
        right[i] *= g
        peak = max(peak, abs(left[i]), abs(right[i]))

    # normalize to -1.5 dBFS with soft tanh limiting for glue
    target = 0.84
    norm = target / peak
    with wave.open('bed.wav', 'w') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        frames = bytearray()
        for i in range(N):
            l = math.tanh(left[i] * norm * 1.05)
            r = math.tanh(right[i] * norm * 1.05)
            frames += struct.pack('<hh', int(l * 32767), int(r * 32767))
        w.writeframes(bytes(frames))
    print('wrote bed.wav', round(DUR, 2), 's, peak(pre-norm)=', round(peak, 3))

if __name__ == '__main__':
    render()
