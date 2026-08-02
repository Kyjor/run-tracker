---
name: bump-app-version
description: >-
  Increments the app marketing version (semver) in package.json, tauri.conf.json,
  and iOS project files before finishing shippable changes. Use when making app
  code changes, preparing a commit/PR for main, or when the user mentions version,
  release, TestFlight, or App Store build numbers.
---

# Bump app version

Remote and local agents must bump the marketing version when they make shippable app changes.

## When to bump

Bump **once per change set** (not per file) when any of these are true:

- User-facing or runtime app code changed (`src/`, `src-tauri/src/`, assets, native iOS config that affects the binary)
- Changes are intended for `main` / TestFlight / App Store

**Skip** for docs-only, comment-only, workflow-only, or skill/rule-only edits unless the user asks.

## Which bump

| Change | Kind |
|--------|------|
| Bugfix, small tweak, default | `patch` |
| New feature / meaningful UX | `minor` |
| Breaking change (only if user asks) | `major` |

Default: **patch**.

## How

From the repo root:

```bash
python3 scripts/bump-version.py patch
# or: minor | major
```

This updates:

- `package.json` / root `package-lock.json` version
- `src-tauri/tauri.conf.json` `version`
- `src-tauri/gen/apple/project.yml` `CFBundleShortVersionString`
- iOS `Info.plist` short version when present

Do **not** hand-edit `CFBundleVersion` / build number — CI sets that from `github.run_number`.

## Checklist before finishing

1. Run the bump script (if this change set warrants it)
2. Include the version file diffs in the same commit as the feature/fix
3. Mention the new version briefly in the commit/PR summary when relevant
