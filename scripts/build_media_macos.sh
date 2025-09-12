#!/usr/bin/env bash
set -euo pipefail

# Build static/portable media stack for macOS (arm64/x86_64).
# Fully static linking is limited on macOS; we build portable dylibs and bundle within .app, fixing rpaths at packaging.
# Default: LGPL-only (no GPL/nonfree). Enable GPL profile via: PROFILE=gpl ./scripts/build_media_macos.sh

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT_DIR/vendor/darwin-universal"
mkdir -p "$OUT_DIR/bin" "$OUT_DIR/lib" "$OUT_DIR/obj"
PROFILE=${PROFILE:-lgpl}

echo "==> Cloning mpv-build"
rm -rf /tmp/mpv-build
git clone --depth=1 https://github.com/mpv-player/mpv-build.git /tmp/mpv-build
cd /tmp/mpv-build

cat > mpv_options <<EOF
-Dgpl=false
-Dswift-build=true
EOF

if [[ "$PROFILE" == "gpl" ]]; then
  echo "--enable-gpl" > ffmpeg_options
else
  echo "--enable-version3 --disable-programs" > ffmpeg_options
fi

export CC=clang CXX=clang++
./rebuild -j"$(sysctl -n hw.ncpu)"

echo "==> Collecting artifacts"
cp -av ./build/bin/mpv "$OUT_DIR/bin/mpv" || true
cp -av ./build/ffmpeg*/fftools/ffmpeg "$OUT_DIR/bin/ffmpeg" || true
cp -av ./build/ffmpeg*/fftools/ffprobe "$OUT_DIR/bin/ffprobe" || true
find ./build -name 'libmpv.*dylib' -exec cp -av {} "$OUT_DIR/lib/" \; || true

echo "==> Done. Artifacts in $OUT_DIR"

