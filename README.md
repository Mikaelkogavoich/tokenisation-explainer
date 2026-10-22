# One building, one token

**TASK-26, Tokenisation Explainer Animation.** An 87 second animated explainer that follows one regulated real world asset, a commercial property fund (a unit trust that owns an office building), from the register it keeps today to a compliant token on Redbelly Network, issued through Tokeniser.

- Voiceover: British English, male (Kokoro-82M, voice `bm_george`, Apache 2.0)
- Subtitles: burned into the main video, plus SRT and WebVTT files
- Style: Tokeniser's own palette (ink `#343740`, mint `#a2ffc8`, warm band `#f3f1ec`) and typeface (Montserrat), flat line illustration, no cartoon or hype styling
- Facts: every claim is matched to a verbatim quote from tokeniser.com, with a dated snapshot of each page in `evidence/`

## Deliverables

| # | Deliverable | File |
|---|---|---|
| 1 | Script, as a shared document | `public/docs/one-building-one-token-script.pdf` and `.docx` (voiceover, on screen text, visuals, timecodes, and the source quote for every claim) |
| 2 | Final video, 1920 x 1080, 60 fps, H.264 MP4, subtitles burned in | `public/video/one-building-one-token.mp4` |
|   | Same video without subtitles | `public/video/one-building-one-token-clean.mp4` |
|   | Subtitles as separate files | `public/video/one-building-one-token.srt`, `.vtt` |
| 3 | Project files | this repository: `content/`, `animation/`, `tools/`, `assets/`, `render.sh` (also zipped at `public/downloads/one-building-one-token-project.zip`) |
| 4 | Licence proof | `LICENSES/` (see `LICENSES/README.md`) |

The website in `public/` plays the video, walks through the four steps, shows the full script with sources, and offers every download.

## The story

| Time | Scene | What the viewer learns |
|---|---|---|
| 0:00 | The asset | An office building, owned through a commercial property fund, with a register kept during business hours |
| 0:07 | What tokenisation means | Ownership recorded as digital tokens, with the rules programmed in. The fund stays a unit trust |
| 0:16 | Step 1, set up | Entity verification, fund details and eligibility rules, encoded into the token's smart contract |
| 0:27 | Step 2, investors | Identity verification and investor classification. No verified wallet, no tokens |
| 0:36 | Step 3, issue | Tokens minted on Redbelly Network and sent to verified wallets; the register updates immediately |
| 0:46 | Step 4, transfer | Every transfer checked against the rules; an ineligible transfer is rejected, a compliant one settles in seconds |
| 0:56 | Running the fund | Distributions in a single on-chain transaction; records current for administrators, auditors and regulators |
| 1:05 | What sits underneath | A familiar platform, no blockchain expertise required, on Redbelly Network, Australia's public digital token infrastructure |
| 1:16 | Close | One building, one fund, now a compliant token. tokeniser.com. Illustrative example only, not investment advice |

## One source for everything

`content/script.json` holds the voiceover, on screen text, visual notes and the source quote for every claim. The voiceover, the animation's words and timing, the subtitles, both script documents and the website are all generated from it, so the video cannot drift from the script.

| Path | What it does |
|---|---|
| `content/script.json` | The single source |
| `content/source_urls.json`, `tools/capture_sources.mjs` | Captures the text of every source page into `evidence/` with `manifest.json` (URL, UTC capture time, SHA-256) |
| `tools/build_voice.py` | Voiceover, one sentence at a time, and the timeline `build/timeline.json` |
| `tools/build_data.py` | Feeds the script, timeline and official logos to the animation (`animation/data.js`) |
| `animation/index.html`, `animation/explainer.js` | The animation. `renderAt(t)` draws any frame as SVG; open `animation/index.html?preview` to scrub through it in a browser |
| `tools/render_frames.mjs` | Renders all 5,211 frames at their exact times (4 parallel workers) and writes the sound cue list from the same key moments |
| `tools/build_audio.py` | Music and sound effects made from code, ducking under the voice, final mix at -16 LUFS |
| `tools/build_subs.py` | SRT and WebVTT, timed like the burned in subtitles |
| `tools/encode.sh` | Final H.264 encode with the build hash in the metadata, and the poster |
| `tools/build_docs.mjs` | Script document as PDF and Word |
| `tools/build_site.py` | The website in `public/` |
| `tools/check.py`, `tools/check_onscreen.mjs` | All checks below |

## Verification

`python3 tools/check.py` runs every check and writes `build/check-report.md`:

- every claim quote is found word for word in its source snapshot, and every snapshot still matches its SHA-256
- the timeline, SRT and WebVTT hold exactly the script's sentences
- every on screen line in the script is actually drawn in its scene (read from the rendered frames)
- both script documents contain every voiceover line and every source quote
- speech recognition (Whisper) of the voiceover matches the script, word error rate under 5%
- both videos are 1920 x 1080, 60 fps, H.264 with AAC audio, 60 to 90 seconds, and carry the build hash of the current script, animation and mix
- the mix is about -16 LUFS with peaks under -1 dBFS
- no price talk, return promises, hype words or exclamation marks; the closing frame carries the illustrative example note
- no names, handles or credit lines in any deliverable, including document and video metadata
- Task Board voice rules: no en or em dashes, emoji, arrow symbols or filler verbs in the site, script, documents or commit messages
- the website and script document carry a dated "last verified" line
- the website loads nothing from outside its own domain, and every file it links to exists
- licence proof is present for the voice model and both fonts

## Rebuild

```
./render.sh
```

Needs Python 3 (`kokoro-onnx soundfile pyloudnorm scipy faster-whisper`), Node 18+ with `playwright` and `docx`, `ffmpeg` and `pdftotext`. The voice model files (`kokoro-v1.0.onnx`, `voices-v1.0.bin`, from the kokoro-onnx v1.0 release) go in `../models` or the folder named by `KOKORO_DIR`.

To recapture the sources: `node tools/capture_sources.mjs`.

## Deploy

The site is static and `public/` is the web root. `vercel.json` sets it as the output directory with no build step, so importing the repository into Vercel deploys it as is. Any static host works the same way.
