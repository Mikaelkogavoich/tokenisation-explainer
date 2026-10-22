#!/usr/bin/env bash
# Rebuilds every deliverable from content/script.json, then runs all checks.
# Needs: python3 (kokoro-onnx soundfile pyloudnorm scipy faster-whisper), node 18+ with playwright and docx, ffmpeg, pdftotext.
# Voice model files go in ../models (or set KOKORO_DIR); see LICENSES/README.md.
set -euo pipefail
cd "$(dirname "$0")"
python3 tools/build_voice.py          # voiceover + timeline
python3 tools/build_data.py           # animation data from script + timeline + logos
node tools/render_frames.mjs 1 build/video-subs.mp4 4    # frames with burned in subtitles (also writes sound cues)
node tools/render_frames.mjs 0 build/video-clean.mp4 4   # frames without subtitles
python3 tools/build_audio.py          # music, sound effects, mix at -16 LUFS
python3 tools/build_subs.py           # SRT + WebVTT
./tools/encode.sh                     # final MP4s + poster
node tools/build_docs.mjs             # script PDF + Word
python3 tools/build_site.py           # website in public/
./tools/package.sh                    # project zip first, so the site link check finds it
python3 tools/check.py                # all checks, report in build/check-report.md
./tools/package.sh                    # project files zip for download
