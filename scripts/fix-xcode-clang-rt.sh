#!/usr/bin/env bash
# Rust 1.87 looks for libclang_rt under clang/17; Xcode 26+ installs clang/21 only.
# This symlink lets the default linker succeed without upgrading Rust.
set -euo pipefail

CLANG_DIR="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/clang"

if [[ ! -d "$CLANG_DIR" ]]; then
  echo "Xcode clang directory not found: $CLANG_DIR"
  exit 1
fi

if [[ -e "$CLANG_DIR/17" ]]; then
  echo "clang/17 already present at $CLANG_DIR/17"
  exit 0
fi

# Prefer the newest version directory (e.g. 21.0.0).
VERSION_DIR="$(find "$CLANG_DIR" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
if [[ -z "$VERSION_DIR" ]]; then
  echo "No clang version directories under $CLANG_DIR"
  exit 1
fi

VERSION_NAME="$(basename "$VERSION_DIR")"
echo "Creating $CLANG_DIR/17 -> $VERSION_NAME (requires sudo)"
sudo ln -sfn "$VERSION_NAME" "$CLANG_DIR/17"
echo "Done. Retry: npm run ios:build:store"
