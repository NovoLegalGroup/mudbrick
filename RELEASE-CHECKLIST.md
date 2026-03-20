# Mudbrick v2 -- Release Checklist

Step-by-step checklist for cutting a production release of Mudbrick v2.

## Pre-Release

- [ ] Pre-7 gate marked PASS in `PRE7-GATE-STATUS.md`
- [ ] Automated test inventory is current (see `AUTOMATED-TEST-INVENTORY.md`)
- [ ] All CI checks green on `mudbrickv2` branch
- [ ] Full manual QA matrix completed (see `QA-MATRIX.md`)
- [ ] Performance baseline measurements within targets (see `PERFORMANCE-BASELINE.md`)
- [ ] No open P0/P1 bugs

## Version Bump

- [ ] Update version in `apps/web/package.json`
- [ ] Update version in `src-tauri/tauri.conf.json` (both `version` and `identifier`)
- [ ] Update version in `apps/api/app/main.py` (if version is tracked there)
- [ ] Update `CHANGELOG.md` with release date

## Build

- [ ] Build sidecar: `scripts/build-sidecar.ps1`
- [ ] Verify sidecar executable exists at expected path
- [ ] Build installer: `pnpm tauri build`
- [ ] Verify `.msi` installer is generated in `src-tauri/target/release/bundle/msi/`
- [ ] Note the installer file size (expected: ~30-60 MB)

## Installer Testing

- [ ] Test installer on clean Windows 10 machine
- [ ] Test installer on clean Windows 11 machine
- [ ] Verify WebView2 is available or bootstrapped
- [ ] Verify sidecar (Python backend) starts automatically
- [ ] Verify health check passes (`http://localhost:8000/api/health`)
- [ ] Open a PDF, perform basic operations (zoom, navigate, annotate)
- [ ] Save and re-open the file
- [ ] Close and relaunch the app -- verify recent files persist

## Code Signing

- [ ] Code sign the installer (if certificate available)
- [ ] Test SmartScreen behavior:
  - Signed: should show no warning
  - Unsigned: should show "Windows protected your PC" -- verify click-through works
- [ ] Verify the executable is not flagged by Windows Defender

## GitHub Release

- [ ] Create a git tag: `git tag -a v2.0.0 -m "Mudbrick v2.0.0"`
- [ ] Push the tag: `git push origin v2.0.0`
- [ ] Create GitHub Release:
  - Title: `Mudbrick v2.0.0`
  - Body: Copy from CHANGELOG.md
  - Attach: `.msi` installer, `.exe` (if portable build exists)
- [ ] Verify auto-updater JSON endpoint is accessible (if configured in Tauri)

## Distribution

- [ ] Pilot distribution to 2-3 team members
- [ ] Collect feedback for 1 week
- [ ] Monitor for crash reports and performance issues
- [ ] Address any P0/P1 issues found during pilot

## Full Rollout

- [ ] Resolve all pilot issues
- [ ] Send migration guide to full team (see `MIGRATION-GUIDE.md`)
- [ ] Full team rollout
- [ ] Verify v1 web app remains accessible as fallback
- [ ] Monitor for 2 weeks post-rollout

## Post-Release

- [ ] Archive the `mudbrickv2` branch (merge to `main`)
- [ ] Update internal documentation
- [ ] Plan v2.1 based on feedback
