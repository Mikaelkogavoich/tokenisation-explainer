"""Builds the static website in public/ from the script. Everything it loads is served from the site itself."""
import json, os, shutil, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *a: os.path.join(ROOT, *a)
S = json.load(open(J("content/script.json"))); TL = json.load(open(J("build/timeline.json")))
e = html.escape
VERIFIED = S["meta"]["last_verified"]
os.makedirs(J("public/fonts"), exist_ok=True); os.makedirs(J("public/img"), exist_ok=True)
for w in (400, 500, 600, 700): shutil.copy(J(f"assets/fonts/Montserrat-{w}.ttf"), J(f"public/fonts/Montserrat-{w}.ttf"))
shutil.copy(J("assets/fonts/IBMPlexMono-500.ttf"), J("public/fonts/IBMPlexMono-500.ttf"))
shutil.copy(J("assets/logos/tokeniser-logo.svg"), J("public/img/tokeniser-logo.svg"))
shutil.copy(J("assets/logos/redbelly-logo.svg"), J("public/img/redbelly-logo.svg"))

def tc(t): m = int(t // 60); return f"{m}:{t - 60 * m:04.1f}"
def size(p):
    try: return f"{os.path.getsize(J('public', p)) / 1e6:.1f} MB"
    except OSError: return ""
starts = {s["id"]: s["start"] for s in TL["scenes"]}
steps = [s for s in S["scenes"] if s["id"] in ("s03", "s04", "s05", "s06")]
step_html = "".join(f'<li><span class="n">{i + 1}</span><h3>{e(s["on_screen"][1])}</h3><p>{e(" ".join(s["vo"][1:]))}</p></li>' for i, s in enumerate(steps))
scene_html = ""
for s in S["scenes"]:
    claims = "".join(f'<li><b>{e(c["covers"])}</b><q>{e(c["quote"])}</q><a href="{e(S["sources"][c["source"]]["url"])}" rel="noopener">{e(S["sources"][c["source"]]["title"])}</a></li>' for c in s["claims"])
    scene_html += f'''<details class="scene"><summary><span class="t">{tc(max(0, starts[s["id"]] - 0.35))}</span><span class="nm">{e(s["name"])}</span><span class="vo">{e(" ".join(s["vo"]))}</span></summary>
<div class="body"><p class="lbl">On screen</p><p>{" · ".join(e(o) for o in s["on_screen"])}</p><p class="lbl">Visual</p><p>{e(s["visual"])}</p><p class="lbl">Sources</p><ul class="claims">{claims}</ul></div></details>'''
downloads = [
    ("Video with subtitles", "video/one-building-one-token.mp4", "MP4 · 1920 x 1080 · 60 fps"),
    ("Video without subtitles", "video/one-building-one-token-clean.mp4", "MP4 · 1920 x 1080 · 60 fps"),
    ("Subtitles", "video/one-building-one-token.srt", "SRT"),
    ("Subtitles", "video/one-building-one-token.vtt", "WebVTT"),
    ("Script document", "docs/one-building-one-token-script.pdf", "PDF"),
    ("Script document", "docs/one-building-one-token-script.docx", "Word"),
    ("Project files and licences", "downloads/one-building-one-token-project.zip", "ZIP"),
]
dl_html = "".join(f'<a class="dl" href="{p}" download><span><b>{e(n)}</b><small>{e(f)} {size(p)}</small></span><span class="ar">Download</span></a>' for n, p, f in downloads)
page = f'''<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>One building, one token · Tokenisation explainer</title>
<meta name="description" content="{e(S["meta"]["subtitle"])}. A {TL["duration"]:.0f} second explainer with a British English voiceover.">
<meta property="og:title" content="One building, one token"><meta property="og:description" content="{e(S["meta"]["subtitle"])}"><meta property="og:image" content="video/poster.png">
<link rel="icon" href="img/favicon.svg">
<style>
@font-face{{font-family:Montserrat;font-weight:400;font-display:swap;src:url(fonts/Montserrat-400.ttf)}}
@font-face{{font-family:Montserrat;font-weight:500;font-display:swap;src:url(fonts/Montserrat-500.ttf)}}
@font-face{{font-family:Montserrat;font-weight:600;font-display:swap;src:url(fonts/Montserrat-600.ttf)}}
@font-face{{font-family:Montserrat;font-weight:700;font-display:swap;src:url(fonts/Montserrat-700.ttf)}}
@font-face{{font-family:Plex;font-weight:500;font-display:swap;src:url(fonts/IBMPlexMono-500.ttf)}}
:root{{--ink:#343740;--muted:#5e6270;--line:#e2ded7;--band:#f3f1ec;--mint:#a2ffc8;--mint2:#54f9a1;--mintInk:#20321f;--teal:#007f7f;--blue:#c9dbf1}}
*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}
body{{margin:0;font:400 17px/1.6 Montserrat,system-ui,sans-serif;color:var(--ink);background:#fff;-webkit-font-smoothing:antialiased}}
a{{color:inherit}}.wrap{{max-width:1120px;margin:0 auto;padding:0 20px}}
header{{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}}
.bar{{display:flex;align-items:center;gap:24px;height:68px}}.bar img{{height:26px;width:auto}}
.bar nav{{margin-left:auto;display:flex;gap:22px;font-weight:500;font-size:15px}}.bar nav a{{text-decoration:none}}.bar nav a:hover{{text-decoration:underline}}
.btn{{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:8px;background:var(--mint);color:var(--mintInk);font-weight:600;text-decoration:none;border:1px solid transparent}}
.btn.ghost{{background:transparent;border-color:var(--ink);color:var(--ink)}}
.hero{{background:var(--ink);color:#fff;padding:72px 0 120px}}
.kick{{font:500 13px Plex,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--mint)}}
h1{{font-size:clamp(36px,6vw,64px);line-height:1.08;margin:14px 0 18px;letter-spacing:-.02em}}
.hero p{{max-width:640px;color:#d6d8de;font-size:19px;margin:0 0 28px}}.hero .btn.ghost{{border-color:#fff;color:#fff}}
.cta{{display:flex;flex-wrap:wrap;gap:12px}}
.player{{margin-top:-84px}}.player video{{width:100%;border-radius:16px;box-shadow:0 24px 60px rgba(52,55,64,.18);background:#000;display:block;aspect-ratio:16/9}}
.facts{{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 0;padding:0;list-style:none}}.facts li{{background:var(--band);border-radius:999px;padding:6px 14px;font-size:14px;font-weight:500}}
section{{padding:64px 0}}section.band{{background:var(--band)}}
h2{{font-size:clamp(28px,4vw,40px);line-height:1.15;margin:8px 0 14px;letter-spacing:-.015em}}.kick.dk{{color:var(--teal)}}
.lead{{color:var(--muted);max-width:720px}}
.steps{{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;list-style:none;padding:0;margin:28px 0 0}}
.steps li{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px}}.steps .n{{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--mint);font-weight:700;color:var(--mintInk)}}
.steps h3{{margin:12px 0 6px;font-size:20px}}.steps p{{margin:0;color:var(--muted);font-size:15px}}
.scene{{border:1px solid var(--line);border-radius:12px;margin:10px 0;background:#fff}}
.scene summary{{cursor:pointer;list-style:none;padding:16px 18px;display:grid;grid-template-columns:64px 1fr;gap:4px 14px}}.scene summary::-webkit-details-marker{{display:none}}
.scene .t{{font:500 13px Plex,monospace;color:var(--teal);padding-top:3px}}.scene .nm{{font-weight:700}}.scene .vo{{grid-column:2;color:var(--muted)}}
.scene .body{{padding:0 18px 16px 96px}}.lbl{{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:10px 0 2px}}.scene .body p{{margin:0}}
.claims{{list-style:none;padding:0;margin:4px 0 0}}.claims li{{border-top:1px solid var(--line);padding:8px 0;font-size:15px}}.claims b{{display:block}}.claims q{{display:block;font-style:italic}}.claims a{{font-size:13px;color:var(--teal)}}
.dls{{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:24px}}
.dl{{display:flex;justify-content:space-between;align-items:center;border:1px solid var(--line);border-radius:12px;padding:16px 18px;text-decoration:none;background:#fff}}.dl:hover{{border-color:var(--ink)}}.dl small{{display:block;color:var(--muted)}}.dl .ar{{font-size:14px;font-weight:600;color:var(--teal);white-space:nowrap}}
.two{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}}.two h3{{margin:0 0 6px}}.two p{{margin:0;color:var(--muted)}}
footer{{background:var(--ink);color:#c9ccd4;padding:36px 0;font-size:14px}}footer .row{{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between}}
footer img{{height:24px;filter:brightness(0) invert(1)}}
@media (max-width:640px){{.bar nav{{display:none}}.scene .body{{padding-left:18px}}.scene summary{{grid-template-columns:1fr}}.scene .vo{{grid-column:1}}}}
</style></head>
<body>
<header><div class="wrap bar"><img src="img/tokeniser-logo.svg" alt="Tokeniser"><nav><a href="#watch">Watch</a><a href="#steps">How it works</a><a href="#script">Script</a><a href="#downloads">Downloads</a></nav></div></header>
<div class="hero"><div class="wrap">
<div class="kick">Tokenisation explainer · {TL["duration"]:.0f} seconds</div>
<h1>One building,<br>one token</h1>
<p>{e(S["meta"]["subtitle"])}. One illustrative asset, followed step by step from the real world to the token, in plain language.</p>
<div class="cta"><a class="btn" href="#watch">Watch the explainer</a><a class="btn ghost" href="docs/one-building-one-token-script.pdf">Read the script</a></div>
</div></div>
<div class="wrap player" id="watch">
<video controls preload="metadata" playsinline poster="video/poster.png"><source src="video/one-building-one-token.mp4" type="video/mp4">Your browser cannot play this video. <a href="video/one-building-one-token.mp4">Download it</a>.</video>
<ul class="facts"><li>{TL["duration"]:.1f} s</li><li>1920 x 1080 · 60 fps</li><li>British English voiceover</li><li>Subtitles burned in, plus SRT and WebVTT</li><li>Illustrative example. Not investment advice.</li><li>Facts last verified {e(VERIFIED)} against tokeniser.com</li></ul>
</div>
<section id="steps"><div class="wrap">
<div class="kick dk">How it works</div><h2>From building to token in four steps</h2>
<p class="lead">The asset is a commercial property fund: a unit trust that owns an office building. {e(" ".join(S["scenes"][1]["vo"]))}</p>
<ol class="steps">{step_html}</ol>
</div></section>
<section class="band" id="script"><div class="wrap">
<div class="kick dk">Script</div><h2>Every line, with its source</h2>
<p class="lead">The voiceover, subtitles, animation and documents are all built from one script file. Open a scene to see the on screen text and the exact quote from the supplied resources behind each claim.</p>
{scene_html}
</div></section>
<section id="downloads"><div class="wrap">
<div class="kick dk">Downloads</div><h2>Deliverables</h2>
<div class="dls">{dl_html}</div>
</div></section>
<section class="band"><div class="wrap two">
<div><h3>Licences</h3><p>Voice: Kokoro-82M, Apache 2.0. Fonts: Montserrat and IBM Plex Mono, SIL Open Font License 1.1. Music and sound effects: generated from code for this project. Logos: official Tokeniser and Redbelly Network marks, used to identify the products.</p></div>
<div><h3>Fact checking</h3><p>Each claim is matched to a verbatim quote from tokeniser.com, captured as a dated text snapshot with a SHA-256 hash and included in the project files. An automated check confirms every quote, subtitle and document line matches the script.</p></div>
</div></section>
<footer><div class="wrap row"><img src="img/tokeniser-logo.svg" alt="Tokeniser"><span>Facts last verified {e(VERIFIED)}. Illustrative example only. Not investment advice. Learn more at <a href="https://tokeniser.com" rel="noopener">tokeniser.com</a>.</span></div></footer>
</body></html>'''
open(J("public/index.html"), "w").write(page)
open(J("public/img/favicon.svg"), "w").write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#343740"/><circle cx="16" cy="16" r="9" fill="#a2ffc8" stroke="#fff" stroke-width="1.5"/></svg>')
json.dump({"framework": None, "buildCommand": "", "outputDirectory": "public", "cleanUrls": True, "headers": [{"source": "/video/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=86400"}]}]}, open(J("vercel.json"), "w"), indent=1)
print("site written")
