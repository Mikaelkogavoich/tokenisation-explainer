"""Voiceover: synthesises every script sentence with Kokoro-82M (British male voice),
trims silence, places the sentences on one timeline and writes build/voice.wav and build/timeline.json."""
import json, os, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.environ.get("KOKORO_DIR", os.path.join(os.path.dirname(ROOT), "models"))
SR = 24000

def trim(a, thr=0.006, pad=0.06):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx):
        return a
    s = max(0, idx[0] - int(pad * SR)); e = min(len(a), idx[-1] + int(pad * SR))
    return a[s:e]

def main():
    script = json.load(open(os.path.join(ROOT, "content/script.json")))
    v, tm = script["voice"], script["timing"]
    k = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
    out, t, timeline = [np.zeros(int(tm["lead_in"] * SR), np.float32)], tm["lead_in"], []
    for si, sc in enumerate(script["scenes"]):
        if si:
            out.append(np.zeros(int(tm["gap_scene"] * SR), np.float32)); t += tm["gap_scene"]
        scene = {"id": sc["id"], "start": round(t, 3), "sentences": []}
        for i, text in enumerate(sc["vo"]):
            if i:
                out.append(np.zeros(int(tm["gap_sentence"] * SR), np.float32)); t += tm["gap_sentence"]
            spoken = text.replace("Tokeniser", "Tokeniser").replace("on-chain", "on chain")
            a, sr = k.create(spoken, voice=v["voice"], speed=v["speed"], lang=v["lang"])
            assert sr == SR
            a = trim(a.astype(np.float32))
            d = len(a) / SR
            scene["sentences"].append({"text": text, "start": round(t, 3), "end": round(t + d, 3)})
            out.append(a); t += d
        scene["end"] = round(t, 3)
        timeline.append(scene)
    out.append(np.zeros(int(tm["tail"] * SR), np.float32)); t += tm["tail"]
    audio = np.concatenate(out)
    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    sf.write(os.path.join(ROOT, "build/voice.wav"), audio, SR, subtype="PCM_16")
    json.dump({"duration": round(t, 3), "scenes": timeline}, open(os.path.join(ROOT, "build/timeline.json"), "w"), indent=1)
    print(f"voice: {t:.2f}s")

if __name__ == "__main__":
    main()
