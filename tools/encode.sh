#!/usr/bin/env bash
# Final encode: H.264 High, yuv420p, 60 fps, AAC 48 kHz, fast start, with the build hash in the metadata.
set -euo pipefail
cd "$(dirname "$0")/.."
HASH=$(cat content/script.json animation/explainer.js tools/build_audio.py | sha256sum | cut -c1-16)
enc() {
  ffmpeg -loglevel error -y -i "$1" -i build/mix.wav -map 0:v -map 1:a \
    -c:v libx264 -preset slow -crf 17 -tune animation -profile:v high -pix_fmt yuv420p -r 60 \
    -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
    -metadata title="One building, one token" -metadata comment="build ${HASH}" "$2"
}
mkdir -p public/video
enc build/video-subs.mp4 public/video/one-building-one-token.mp4
[ -f build/video-clean.mp4 ] && enc build/video-clean.mp4 public/video/one-building-one-token-clean.mp4
ffmpeg -loglevel error -y -ss 85.6 -i build/video-subs.mp4 -frames:v 1 -vf scale=1280:-2 -q:v 3 public/video/poster.jpg
echo "encoded, build ${HASH}"
