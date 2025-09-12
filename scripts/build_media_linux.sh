#!/usr/bin/env bash
set -euo pipefail

# Build static mpv + FFmpeg + libass + libplacebo using mpv-build on Linux.
# Default: LGPL-only (no GPL/nonfree). Enable GPL profile via: PROFILE=gpl ./scripts/build_media_linux.sh

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT_DIR/vendor/linux-$(uname -m)"
mkdir -p "$OUT_DIR/bin" "$OUT_DIR/lib" "$OUT_DIR/obj"

PROFILE=${PROFILE:-lgpl}

echo "==> Cloning mpv-build (shallow)"
rm -rf /tmp/mpv-build
git clone --depth=1 https://github.com/mpv-player/mpv-build.git /tmp/mpv-build
cd /tmp/mpv-build

echo "-Dgpl=false" > mpv_options
if [[ "$PROFILE" == "gpl" ]]; then
  echo "--enable-gpl" > ffmpeg_options
else
  echo "--enable-version3 --disable-programs" > ffmpeg_options
fi

./rebuild -j"$(nproc)"

echo "==> Collecting artifacts"
cp -av ./build/bin/mpv "$OUT_DIR/bin/mpv"
cp -av ./build/ffmpeg*/fftools/ffmpeg "$OUT_DIR/bin/ffmpeg" || true
cp -av ./build/ffmpeg*/fftools/ffprobe "$OUT_DIR/bin/ffprobe" || true

# Copy static libmpv if produced
find ./build -name 'libmpv.*' -exec cp -av {} "$OUT_DIR/lib/" \; || true

echo "==> Done. Artifacts in $OUT_DIR"

