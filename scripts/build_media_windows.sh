#!/usr/bin/env bash
set -euo pipefail

# Windows build via MSYS2/MinGW-w64. This script is a guide; run inside MSYS2 shell.
# Default: LGPL-only (no GPL/nonfree). Enable GPL via PROFILE=gpl ./scripts/build_media_windows.sh

echo "This script is a template. Run inside MSYS2 with required toolchains installed."
exit 0

# Example steps (inside MSYS2):
# pacman -S --needed git base-devel mingw-w64-ucrt-x86_64-toolchain mingw-w64-ucrt-x86_64-pkg-config \
#   mingw-w64-ucrt-x86_64-meson mingw-w64-ucrt-x86_64-ninja
# git clone https://github.com/mpv-player/mpv-build && cd mpv-build
# echo "-Dgpl=false" > mpv_options
# echo "--pkg-config-flags=--static --enable-static --disable-shared" > ffmpeg_options
# ./rebuild -j$(nproc)

