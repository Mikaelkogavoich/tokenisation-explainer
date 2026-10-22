"""Music, sound effects and final mix, all made from code (no third party audio).
Writes build/music.wav, build/sfx.wav and build/mix.wav (48 kHz stereo, about -16 LUFS)."""
import json, os
import numpy as np, soundfile as sf
import pyloudnorm as pyln
from scipy.signal import butter, sosfilt, resample_poly

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(26)
B = lambda *a: os.path.join(ROOT, "build", *a)

def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], "band", fs=SR, output="sos"), x)
def smooth(x, w):
    # moving average via cumulative sum
    c = np.cumsum(np.concatenate([[0.0], x])); h = w // 2
    i = np.arange(len(x)); a = np.clip(i - h, 0, len(x)); b = np.clip(i + h, 0, len(x))
    return (c[b] - c[a]) / np.maximum(1, b - a)
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def env(n, a, r):
    e = np.ones(n); ai = min(n, int(a * SR)); ri = min(n, int(r * SR))
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e

def music(dur):
    n = int(dur * SR); L = np.zeros(n); R = np.zeros(n)
    bpm = 84; beat = 60 / bpm; bar = 4 * beat; chord_len = 2 * bar
    # D major colour: Dmaj9, Bm7, Gmaj7, A sus
    chords = [[50, 57, 62, 64, 66, 69], [47, 54, 59, 62, 66, 69], [43, 50, 55, 59, 62, 66], [45, 52, 57, 59, 62, 64]]
    t = 0.0; ci = 0
    while t < dur:
        ch = chords[ci % 4]; s = int(t * SR); m = min(n - s, int((chord_len + 1.5) * SR))
        tt = np.arange(m) / SR
        pad = np.zeros(m)
        for j, note in enumerate(ch[1:]):
            f = midi(note + 12 * (j > 2))
            for det in (-0.12, 0.12):
                pad += np.sin(2 * np.pi * f * (1 + det / 100) * tt + j) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * tt + j))
        pad = lp(pad, 1800) * env(m, 1.4, 1.6) * 0.035
        bass = np.sin(2 * np.pi * midi(ch[0] - 12) * tt) * env(m, 0.3, 1.5) * 0.10
        L[s:s + m] += pad + bass; R[s:s + m] += np.roll(pad, 240) + bass
        # soft plucked arpeggio in eighths
        arp = [ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12]
        for k in range(int(chord_len / (beat / 2))):
            st = s + int(k * beat / 2 * SR)
            if st >= n: break
            ln = min(n - st, int(1.2 * SR)); x = np.arange(ln) / SR
            f = midi(arp[k % 4])
            v = (np.sin(2 * np.pi * f * x) + 0.25 * np.sin(4 * np.pi * f * x)) * np.exp(-x * 5.5) * 0.028 * (0.8 if k % 2 else 1)
            pan = 0.35 + 0.3 * ((k % 4) / 3)
            L[st:st + ln] += v * (1 - pan); R[st:st + ln] += v * pan
        t += chord_len; ci += 1
    out = np.stack([L, R], 1)
    fade = env(n, 2.0, 3.5); out *= fade[:, None]
    return out

def sfx(kind):
    def tl(d): return np.arange(int(d * SR)) / SR
    if kind == "tick":
        x = tl(0.06); return np.sin(2 * np.pi * 2300 * x) * np.exp(-x * 90) * 0.35
    if kind == "pop":
        x = tl(0.16); f = 660 + 380 * np.exp(-x * 40)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 26) * 0.32
    if kind == "paper":
        x = tl(0.22); return bp(rng.standard_normal(len(x)), 1500, 6000) * np.exp(-x * 18) * 0.10
    if kind == "sweep":
        x = tl(0.55); nz = rng.standard_normal(len(x))
        e = np.sin(np.pi * x / x[-1]) ** 2
        return (lp(nz, 900) * 0.5 + bp(nz, 600, 3200) * 0.25) * e * 0.10
    if kind == "swell":
        x = tl(1.2); e = np.sin(np.pi * x / x[-1]) ** 2
        return (lp(rng.standard_normal(len(x)), 1200) * 0.06 + np.sin(2 * np.pi * 220 * x) * 0.05) * e
    if kind == "chime":
        x = tl(1.6); v = 0
        for f, a in ((midi(81), 1), (midi(88), 0.6), (midi(93), 0.3)):
            v = v + np.sin(2 * np.pi * f * x) * a
        return v * np.exp(-x * 3.2) * 0.10
    if kind == "thud":
        x = tl(0.35); f = 150 * np.exp(-x * 3)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 14) * 0.45 + bp(rng.standard_normal(len(x)), 200, 900) * np.exp(-x * 40) * 0.08)
    raise ValueError(kind)

def main():
    voice, vsr = sf.read(B("voice.wav"), dtype="float64")
    voice = resample_poly(voice, SR, vsr); voice = hp(voice, 70)
    dur = len(voice) / SR; n = len(voice)
    mus = music(dur)[:n]
    # duck the music under the voice
    envv = smooth(np.abs(voice), int(0.05 * SR))
    speech = (envv > 0.01).astype(float)
    speech = smooth(speech, int(0.4 * SR))
    duck = 1 - 0.45 * np.clip(speech * 1.5, 0, 1)
    mus *= duck[:, None]
    fx = np.zeros((n, 2))
    for c in json.load(open(B("sfx_cues.json"))):
        a = sfx(c["s"]); s = int(c["t"] * SR)
        if s < 0 or s >= n: continue
        m = min(len(a), n - s); fx[s:s + m, 0] += a[:m]; fx[s:s + m, 1] += a[:m]
    meter = pyln.Meter(SR)
    v2 = np.stack([voice, voice], 1)
    v2 = pyln.normalize.loudness(v2, meter.integrated_loudness(v2), -17.0)
    mus = pyln.normalize.loudness(mus, meter.integrated_loudness(mus), -33.0)
    fx *= 0.5
    mix = v2 + mus + fx
    mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -16.0)
    # soft knee limiter above 0.7 keeps peaks under about -1.5 dBFS without lowering the overall level
    a = np.abs(mix); k = 0.7
    mix = np.where(a > k, np.sign(mix) * (k + 0.14 * np.tanh((a - k) / 0.14)), mix)
    sf.write(B("music.wav"), mus.astype(np.float32), SR)
    sf.write(B("sfx.wav"), fx.astype(np.float32), SR)
    sf.write(B("mix.wav"), mix.astype(np.float32), SR, subtype="PCM_24")
    print(f"mix: {dur:.2f}s, {meter.integrated_loudness(mix):.1f} LUFS, peak {20*np.log10(np.max(np.abs(mix))):.1f} dBFS")

if __name__ == "__main__":
    main()
