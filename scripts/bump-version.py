#!/usr/bin/env python3
"""Bump app marketing version across Tauri iOS project files.

Usage:
  python3 scripts/bump-version.py [patch|minor|major]

Updates:
  - package.json
  - package-lock.json (root package version only)
  - src-tauri/tauri.conf.json
  - src-tauri/gen/apple/project.yml (CFBundleShortVersionString)
  - src-tauri/gen/apple/*/Info.plist (CFBundleShortVersionString), if present

Does not change CFBundleVersion / build number (CI sets that from run number).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def bump(ver: str, kind: str) -> str:
    parts = ver.strip().split(".")
    while len(parts) < 3:
        parts.append("0")
    major, minor, patch = (int(parts[0]), int(parts[1]), int(parts[2]))
    if kind == "major":
        major, minor, patch = major + 1, 0, 0
    elif kind == "minor":
        minor, patch = minor + 1, 0
    else:
        patch += 1
    return f"{major}.{minor}.{patch}"


def main() -> None:
    kind = (sys.argv[1] if len(sys.argv) > 1 else "patch").lower()
    if kind not in {"patch", "minor", "major"}:
        print("usage: bump-version.py [patch|minor|major]", file=sys.stderr)
        sys.exit(2)

    pkg_path = ROOT / "package.json"
    pkg = json.loads(pkg_path.read_text())
    old = str(pkg.get("version", "0.0.0"))
    new = bump(old, kind)
    pkg["version"] = new
    pkg_path.write_text(json.dumps(pkg, indent=2) + "\n")

    lock_path = ROOT / "package-lock.json"
    if lock_path.exists():
        lock = json.loads(lock_path.read_text())
        lock["version"] = new
        if isinstance(lock.get("packages"), dict) and "" in lock["packages"]:
            lock["packages"][""]["version"] = new
        lock_path.write_text(json.dumps(lock, indent=2) + "\n")

    tauri_path = ROOT / "src-tauri" / "tauri.conf.json"
    if tauri_path.exists():
        tauri = json.loads(tauri_path.read_text())
        tauri["version"] = new
        tauri_path.write_text(json.dumps(tauri, indent=2) + "\n")

    yml = ROOT / "src-tauri" / "gen" / "apple" / "project.yml"
    if yml.exists():
        text = yml.read_text()
        text2, n = re.subn(
            r'(CFBundleShortVersionString:\s*)["\']?[\d.]+["\']?',
            rf'\1"{new}"',
            text,
            count=1,
        )
        if n:
            yml.write_text(text2)

    for plist in (ROOT / "src-tauri" / "gen" / "apple").glob("*_iOS/Info.plist"):
        text = plist.read_text()
        text2, n = re.subn(
            r"(<key>CFBundleShortVersionString</key>\s*<string>)[^<]+",
            rf"\g<1>{new}",
            text,
            count=1,
        )
        if n:
            plist.write_text(text2)

    print(f"{old} -> {new} ({kind})")


if __name__ == "__main__":
    main()
