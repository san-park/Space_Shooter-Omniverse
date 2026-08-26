#!/usr/bin/env bash
# Replace the game's home background image:
# - saves a raw backup to assets/ui/frame_mode_orig.<ext>
# - produces an optimized 1536x1024 JPEG at assets/ui/frame_mode.jpg
# - stages, commits, and pushes to the specified branch (default: main)
#
# Usage: ./replace_home_image.sh /full/path/to/1.PNG [branch]
# Example: ./replace_home_image.sh ~/Downloads/1.PNG main

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/image [branch]"
  exit 1
fi

IMG_SRC="$1"
BRANCH="${2:-main}"

if [ ! -f "$IMG_SRC" ]; then
  echo "Error: source image not found: $IMG_SRC"
  exit 2
fi

# Ensure we're inside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run this script from inside your git repo root (or a subdir)."
  exit 3
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DEST_DIR="assets/ui"
mkdir -p "$DEST_DIR"

# Determine extension and set filenames
ext="${IMG_SRC##*.}"
ext_lc="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
ORIG_NAME="frame_mode_orig.${ext_lc}"
OUT_NAME="frame_mode.jpg"

# Copy original raw file
cp -f "$IMG_SRC" "$DEST_DIR/$ORIG_NAME"
echo "Saved raw backup: $DEST_DIR/$ORIG_NAME"

# Check for ImageMagick 'convert'
if command -v convert >/dev/null 2>&1; then
  # Create optimized JPG resized to 1536x1024 (center-crop if needed), denoise/sharpen, quality 85
  convert "$DEST_DIR/$ORIG_NAME" -resize 1536x1024^ -gravity center -extent 1536x1024 -strip -quality 85 -unsharp 0x1 "$DEST_DIR/$OUT_NAME"
  echo "Created optimized image: $DEST_DIR/$OUT_NAME"
else
  echo "Warning: ImageMagick 'convert' not found. Copying original as $OUT_NAME without processing."
  # Try to copy and convert extension if already jpg; else copy and warn
  cp -f "$DEST_DIR/$ORIG_NAME" "$DEST_DIR/$OUT_NAME"
fi

# Git operations: add, commit, push
git add "$DEST_DIR/$ORIG_NAME" "$DEST_DIR/$OUT_NAME"

# If nothing to commit, exit cleanly
if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

COMMIT_MSG="chore(ui): replace home screen art (frame_mode.jpg) — added orig backup"
git commit -m "$COMMIT_MSG"

# Push to branch (may prompt for auth if needed)
git push origin "$BRANCH"

echo "Done. Committed and pushed to origin/$BRANCH"
echo "Files updated:"
echo " - $DEST_DIR/$ORIG_NAME"
echo " - $DEST_DIR/$OUT_NAME"
