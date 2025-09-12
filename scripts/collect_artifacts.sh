#!/usr/bin/env bash
set -euo pipefail

# Copy platform artifacts from vendor/<target>/bin into src-tauri/bin for Tauri packaging.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DEST="$ROOT_DIR/src-tauri/bin"
mkdir -p "$DEST"

TARGET=${1:-}
if [[ -z "$TARGET" ]]; then
  UNAME=$(uname -s)
  ARCH=$(uname -m)
  case "$UNAME" in
    Linux) TARGET="linux-$ARCH";;
    Darwin) TARGET="darwin-universal";;
    *) echo "Unsupported OS"; exit 1;;
  esac
fi

SRC="$ROOT_DIR/vendor/$TARGET/bin"
echo "Copying from $SRC to $DEST"
cp -av "$SRC"/* "$DEST"/
echo "Done."

