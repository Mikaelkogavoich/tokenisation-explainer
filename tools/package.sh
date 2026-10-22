#!/usr/bin/env bash
# Zips the project files and licences for download from the website (videos are left out to keep it small).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/downloads build
rm -f public/downloads/one-building-one-token-project.zip
zip -qr public/downloads/one-building-one-token-project.zip README.md render.sh vercel.json content animation tools assets evidence LICENSES \
  build/timeline.json build/sfx_cues.json build/check-report.md build/asr-transcript.txt \
  public/docs public/video/one-building-one-token.srt public/video/one-building-one-token.vtt
echo "zip: $(du -h public/downloads/one-building-one-token-project.zip | cut -f1)"
