"""Writes animation/data.js from the script, the voice timeline and the two official logos,
so the animation reads exactly the same words and times as the voiceover."""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
script = json.load(open(os.path.join(ROOT, "content/script.json")))
timeline = json.load(open(os.path.join(ROOT, "build/timeline.json")))

def svg_parts(path):
    s = open(os.path.join(ROOT, path)).read()
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    inner = s[s.index(">", s.index("<svg")) + 1: s.rindex("</svg>")]
    inner = re.sub(r'var\(--fill-0, (#[0-9A-Fa-f]+)\)', r'\1', inner)
    return {"viewBox": vb, "inner": inner}

def mark_only(parts, max_x=40):
    # the cube mark is drawn by the paths that start left of max_x; the wordmark sits to its right
    paths = re.findall(r"<path[^>]*/>", parts["inner"], re.S)
    keep = [q for q in paths if float(re.search(r'd="M\s*([0-9.]+)', q).group(1)) < max_x]
    return {"viewBox": f"0 0 {max_x - 1} 46", "inner": "".join(keep)}

rb = svg_parts("assets/logos/redbelly-logo.svg")
data = {
    "script": script,
    "timeline": timeline,
    "logos": {"tokeniser": svg_parts("assets/logos/tokeniser-logo.svg"), "redbelly": rb, "redbellyMark": mark_only(rb)},
}
with open(os.path.join(ROOT, "animation/data.js"), "w") as f:
    f.write("window.DATA = " + json.dumps(data, ensure_ascii=False) + ";\n")
print("data.js written")
