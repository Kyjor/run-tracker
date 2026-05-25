#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${IOS_RELEASE_ENV_FILE:-$ROOT_DIR/.ios-release.local.env}"
BUILD_DIR="$ROOT_DIR/src-tauri/gen/apple/build/arm64"

usage() {
  cat <<'EOF'
Usage: scripts/ios-release.sh [--build-only | --upload-only]

Builds the iOS app for App Store Connect and uploads the IPA with xcrun altool.

Credentials live in .ios-release.local.env (gitignored). Copy from
.ios-release.local.env.example and fill in your values.

Requires AuthKey_<API_KEY>.p8 in ~/.appstoreconnect/private_keys/

If the Rust step fails with "library 'clang_rt.ios' not found":
  bash scripts/fix-xcode-clang-rt.sh
  # or: rustup update stable
EOF
}

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE"
    echo "Copy .ios-release.local.env.example to .ios-release.local.env"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  : "${APP_STORE_API_KEY:?Set APP_STORE_API_KEY in $ENV_FILE}"
  : "${APP_STORE_API_ISSUER:?Set APP_STORE_API_ISSUER in $ENV_FILE}"

  local key_file="$HOME/.appstoreconnect/private_keys/AuthKey_${APP_STORE_API_KEY}.p8"
  if [[ ! -f "$key_file" ]]; then
    echo "Missing App Store Connect API key: $key_file"
    echo "Download the .p8 key from App Store Connect and place it there."
    exit 1
  fi
}

find_ipa() {
  if [[ -n "${IOS_IPA_PATH:-}" && -f "$IOS_IPA_PATH" ]]; then
    echo "$IOS_IPA_PATH"
    return
  fi

  local ipa
  ipa="$(find "$BUILD_DIR" -maxdepth 1 -name '*.ipa' -print -quit 2>/dev/null || true)"
  if [[ -z "$ipa" ]]; then
    echo "No IPA found in $BUILD_DIR"
    echo "Run with --build-only first, or set IOS_IPA_PATH."
    exit 1
  fi
  echo "$ipa"
}

run_build() {
  echo "Building iOS app for App Store Connect..."
  if rustc --version | grep -q '1\.87\.'; then
    echo "Note: Rust 1.87 needs clang/17 or an update. Run: bash scripts/fix-xcode-clang-rt.sh"
  fi
  cd "$ROOT_DIR"
  npx tauri ios build --export-method app-store-connect
}

run_upload() {
  local ipa
  ipa="$(find_ipa)"
  echo "Uploading $ipa to App Store Connect..."
  xcrun altool \
    --upload-app \
    --type ios \
    --file "$ipa" \
    --apiKey "$APP_STORE_API_KEY" \
    --apiIssuer "$APP_STORE_API_ISSUER"
}

MODE="${1:-all}"

case "$MODE" in
  --help|-h)
    usage
    exit 0
    ;;
  --build-only)
    run_build
    ;;
  --upload-only)
    load_env
    run_upload
    ;;
  all|"")
    load_env
    run_build
    run_upload
    ;;
  *)
    echo "Unknown option: $MODE"
    usage
    exit 1
    ;;
esac

echo "Done."
