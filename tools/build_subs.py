"""SRT and WebVTT subtitles from the voice timeline, timed exactly as the burned in subtitles."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tl = json.load(open(os.path.join(ROOT, "build/timeline.json")))

def split(text, limit=50):
    if len(text) <= limit: return [text]
    w = text.split(); best = None
    for i in range(1, len(w)):
        a, b = " ".join(w[:i]), " ".join(w[i:])
        if best is None or max(len(a), len(b)) < best[0]: best = (max(len(a), len(b)), [a, b])
    return best[1]

def stamp(t, sep):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"

cues = [s for sc in tl["scenes"] for s in sc["sentences"]]
srt, vtt = [], ["WEBVTT", ""]
for i, c in enumerate(cues):
    nx = cues[i + 1] if i + 1 < len(cues) else None
    a, b = max(0, c["start"] - 0.05), min(c["end"] + 0.35, nx["start"] - 0.05 if nx else c["end"] + 0.6)
    lines = split(c["text"])
    srt += [str(i + 1), f"{stamp(a, ',')} --> {stamp(b, ',')}", *lines, ""]
    vtt += [f"{stamp(a, '.')} --> {stamp(b, '.')}", *lines, ""]
os.makedirs(os.path.join(ROOT, "public/video"), exist_ok=True)
open(os.path.join(ROOT, "public/video/one-building-one-token.srt"), "w").write("\n".join(srt))
open(os.path.join(ROOT, "public/video/one-building-one-token.vtt"), "w").write("\n".join(vtt))
print(len(cues), "cues")
