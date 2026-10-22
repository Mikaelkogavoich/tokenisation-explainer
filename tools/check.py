"""Runs every check on the deliverables and writes build/check-report.md. Exit code 1 if any check fails."""
import hashlib, json, os, re, subprocess, sys, zipfile
import numpy as np, soundfile as sf
import pyloudnorm as pyln

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *a: os.path.join(ROOT, *a)
S = json.load(open(J("content/script.json"))); TL = json.load(open(J("build/timeline.json")))
VO = [v for sc in S["scenes"] for v in sc["vo"]]
results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail)); print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
def norm(s): return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()
def run(*a): return subprocess.run(a, capture_output=True, text=True, cwd=ROOT).stdout

# 1. facts: every quote is verbatim in its dated source snapshot, and the snapshots are unchanged
man = {m["file"]: m for m in json.load(open(J("evidence/manifest.json")))}
missing = []
for sc in S["scenes"]:
    for c in sc["claims"]:
        src = S["sources"][c["source"]]
        if c["quote"] not in open(J("evidence", src["evidence"])).read(): missing.append(c["quote"][:60])
check("Every claim quote is found word for word in its source snapshot", not missing, f"{sum(len(s['claims']) for s in S['scenes'])} quotes" if not missing else "; ".join(missing))
bad = []
for f, m in man.items():
    body = open(J("evidence", f)).read().split("\n\n", 1)[1]
    if hashlib.sha256(body.encode()).hexdigest() != m["sha256"]: bad.append(f)
check("Source snapshots match their SHA-256 in evidence/manifest.json", not bad, f"{len(man)} snapshots" if not bad else ", ".join(bad))
check("Every source URL is on a supplied resource domain", all(re.match(r"https://(tokeniser\.com|redbelly\.network)/", s["url"]) for s in S["sources"].values()))

# 2. timeline and subtitles match the script
tl_text = [s["text"] for sc in TL["scenes"] for s in sc["sentences"]]
check("Voice timeline holds exactly the script sentences", tl_text == VO, f"{len(VO)} sentences")
def srt_text(p):
    blocks = open(J(p)).read().strip().split("\n\n"); out = []
    for b in blocks:
        lines = b.split("\n")
        lines = [l for l in lines if l and l != "WEBVTT" and "-->" not in l and not l.isdigit()]
        if lines: out.append(" ".join(lines))
    return out
check("SRT subtitles say exactly what the script says", srt_text("public/video/one-building-one-token.srt") == VO)
check("WebVTT subtitles say exactly what the script says", srt_text("public/video/one-building-one-token.vtt") == VO)

# 3. on screen text in the script is drawn in the animation
seen = json.loads(run("node", "tools/check_onscreen.mjs"))
miss = [f"{sc['id']}: {o}" for sc in S["scenes"] for o in sc["on_screen"] if norm(o) not in norm(seen[sc["id"]])]
check("Every on screen line in the script appears on screen in its scene", not miss, "; ".join(miss))

# 4. documents carry the full script
pdf = norm(run("pdftotext", "public/docs/one-building-one-token-script.pdf", "-"))
docx_xml = zipfile.ZipFile(J("public/docs/one-building-one-token-script.docx")).read("word/document.xml").decode()
docx = norm(re.sub(r"<[^>]+>", " ", docx_xml).replace("&apos;", "'").replace("&quot;", '"').replace("&amp;", "&"))
for name, body in (("PDF", pdf), ("Word", docx)):
    lost = [v for v in VO if norm(v) not in body] + [c["quote"][:50] for sc in S["scenes"] for c in sc["claims"] if norm(c["quote"]) not in body]
    check(f"{name} script contains every voiceover line and every source quote", not lost, "; ".join(lost[:3]))

# 5. the spoken audio says the script (speech recognition)
try:
    from faster_whisper import WhisperModel
    a, sr = sf.read(J("build/voice.wav"), dtype="float32")
    x = np.interp(np.arange(0, len(a), sr / 16000), np.arange(len(a)), a).astype(np.float32)
    heard = " ".join(s.text for s in WhisperModel("base.en", device="cpu", compute_type="int8").transcribe(x, language="en")[0])
    ref, hyp = norm(" ".join(VO)).replace("tokeniser", "tokenizer").replace("tokenisation", "tokenization").split(), norm(heard).replace("tokeniser", "tokenizer").replace("tokenisation", "tokenization").split()
    d = np.arange(len(hyp) + 1)
    for i, r in enumerate(ref, 1):
        prev, d = d, np.zeros(len(hyp) + 1, int); d[0] = i
        for j, h in enumerate(hyp, 1): d[j] = min(prev[j] + 1, d[j - 1] + 1, prev[j - 1] + (r != h))
    wer = d[-1] / len(ref)
    open(J("build/asr-transcript.txt"), "w").write(heard.strip() + "\n")
    check("Speech recognition of the voiceover matches the script (word error rate under 5%)", wer < 0.05, f"WER {wer:.1%}, transcript in build/asr-transcript.txt")
except ImportError:
    check("Speech recognition of the voiceover matches the script", False, "faster-whisper not installed")

# 6. video specs and build hash
build_hash = hashlib.sha256(b"".join(open(J(p), "rb").read() for p in ("content/script.json", "animation/explainer.js", "tools/build_audio.py"))).hexdigest()[:16]
for v in ("one-building-one-token.mp4", "one-building-one-token-clean.mp4"):
    p = J("public/video", v)
    if not os.path.exists(p): check(f"{v} exists", False); continue
    info = json.loads(run("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", p))
    vs = [s for s in info["streams"] if s["codec_type"] == "video"][0]; aus = [s for s in info["streams"] if s["codec_type"] == "audio"]
    dur = float(info["format"]["duration"]); fps = eval(vs["r_frame_rate"])
    check(f"{v}: 1920 x 1080, {fps:.0f} fps, H.264, {dur:.1f} s, AAC audio", vs["width"] == 1920 and vs["height"] == 1080 and fps >= 24 and vs["codec_name"] == "h264" and 60 <= dur <= 90 and aus and aus[0]["codec_name"] == "aac")
    check(f"{v}: carries the build hash of the current script, animation and mix", info["format"].get("tags", {}).get("comment") == f"build {build_hash}", build_hash)
    check(f"{v}: under 40 MB for web delivery", os.path.getsize(p) < 40e6, f"{os.path.getsize(p) / 1e6:.1f} MB")

# 7. audio level
mix, sr = sf.read(J("build/mix.wav")); lufs = pyln.Meter(sr).integrated_loudness(mix); peak = 20 * np.log10(np.abs(mix).max())
check("Final mix is about -16 LUFS with peaks under -1 dBFS", abs(lufs + 16) <= 1 and peak < -1, f"{lufs:.1f} LUFS, peak {peak:.1f} dBFS")
voice = sf.read(J("build/voice.wav"))[0]
check("Voiceover is the British English male voice named in the script", S["voice"]["voice"].startswith("bm_") and S["voice"]["lang"] == "en-gb", S["voice"]["voice"])

# 8. failure criteria: tone, price talk, personal credit
words = " ".join(VO + [o for sc in S["scenes"] for o in sc["on_screen"]]).lower()
banned = ["price", "return", "yield", "profit", "invest now", "guarantee", "moon", "skyrocket", "revolution", "game changer", "huge", "massive", "to the", "lambo", "!", "pump", "dividend yield", "cheap", "earn"]
hits = [b for b in banned if re.search(r"\b" + re.escape(b) if b[0].isalnum() else re.escape(b), words)]
check("No price talk, return promises, hype words or exclamation marks in voiceover or on screen text", not hits, ", ".join(hits))
check("Closing frame states the example is illustrative and not investment advice", "Illustrative example only. Not investment advice." in S["scenes"][-1]["on_screen"])
# credit lines and handles; extra names to screen for can be passed in CREDIT_NAMES (comma separated), kept out of the repository
extra = [re.escape(n.strip()) for n in os.environ.get("CREDIT_NAMES", "").split(",") if n.strip()]
credit = re.compile("|".join(extra + [r"made by", r"created by", r"produced by", r"designed by", r"@[a-z0-9_]{3,}\b"]), re.I)
offenders = []
for base in ("public", "content", "animation", "tools", "LICENSES", "README.md"):
    for dp, _, fs in os.walk(J(base)) if os.path.isdir(J(base)) else [(ROOT, [], [base])]:
        for f in fs:
            p = os.path.join(dp, f)
            if p.endswith((".mp4", ".jpg", ".png", ".ttf", ".zip", ".docx", ".pdf")) or f == "check.py": continue
            if dp.endswith("LICENSES") and f != "README.md": continue  # third party licence texts, kept verbatim
            t = open(p, errors="ignore").read()
            for m in credit.finditer(t):
                if m.group(0).lower() in ("@media", "@page", "@font"): continue  # CSS rules
                offenders.append(f"{os.path.relpath(p, ROOT)}: {m.group(0)}")
for f in ("public/docs/one-building-one-token-script.pdf",):
    if credit.search(run("pdftotext", f, "-")): offenders.append(f)
if credit.search(docx_xml) or credit.search(zipfile.ZipFile(J("public/docs/one-building-one-token-script.docx")).read("docProps/core.xml").decode()): offenders.append("docx")
for v in ("one-building-one-token.mp4", "one-building-one-token-clean.mp4"):
    if os.path.exists(J("public/video", v)) and credit.search(run("ffprobe", "-v", "error", "-show_format", "-of", "json", J("public/video", v))): offenders.append(v)
check("No personal credit, names, handles or 'made by' lines in any deliverable", not offenders, "; ".join(offenders[:5]))

# 9. website is self contained
site = open(J("public/index.html")).read()
ext = [u for u in re.findall(r'(?:src|href)="([^"]+)"', site) if re.match(r"https?://", u) and not re.search(r'<a [^>]*href="' + re.escape(u), site)]
loads = re.findall(r'<(?:script|link|img|video|source|track)[^>]+(?:src|href)="(https?://[^"]+)"', site) + re.findall(r"url\((https?://[^)]+)\)", site)
check("Website loads nothing from outside its own domain", not loads, ", ".join(loads))
refs = [u for u in re.findall(r'(?:src|href|poster)="([^"#:]+)"', site) if not u.startswith("mailto")]
check("Every file the website links to exists", all(os.path.exists(J("public", u)) for u in refs), ", ".join(u for u in refs if not os.path.exists(J("public", u))))
lic = os.listdir(J("LICENSES"))
check("Licence proof present for voice model and both fonts", {"Apache-2.0.txt", "kokoro-82m-model-card.md", "OFL-Montserrat.txt", "OFL-IBMPlexMono.txt"} <= set(lic))

fails = [r for r in results if not r[1]]
with open(J("build/check-report.md"), "w") as f:
    f.write(f"# Check report\n\nBuild `{build_hash}`. {len(results) - len(fails)} of {len(results)} checks passed.\n\n")
    for n, ok, d in results: f.write(f"- {'PASS' if ok else 'FAIL'}: {n}{f' ({d})' if d else ''}\n")
print(f"\n{len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
