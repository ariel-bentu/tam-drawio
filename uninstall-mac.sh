#!/bin/bash
# Removes the tam-drawio plugin from draw.io Desktop on macOS and
# uninstalls the LaunchAgent update watcher.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRAWIO_APP="/Applications/draw.io.app"
ASAR="$DRAWIO_APP/Contents/Resources/app.asar"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(eval echo "~$TARGET_USER")
SUPPORT_DIR="$TARGET_HOME/Library/Application Support/tam-drawio"
PLIST="$TARGET_HOME/Library/LaunchAgents/io.tam-drawio.watcher.plist"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}▸${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
error() { echo -e "${RED}✖${NC}  $*" >&2; }

# If draw.io exists and its asar is root-owned, we need sudo for the asar cleanup.
if [ -d "$DRAWIO_APP" ] && [ -f "$ASAR" ] && [ ! -w "$ASAR" ] && [ "$EUID" -ne 0 ]; then
    warn "draw.io.app is owned by root — re-running with sudo..."
    exec sudo bash "$0" "$@"
fi

# ── Remove LaunchAgent ────────────────────────────────────────────────────────

if [ -f "$PLIST" ]; then
    info "Unloading update watcher..."
    if [ "$EUID" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
        sudo -u "$SUDO_USER" launchctl unload "$PLIST" 2>/dev/null || true
    else
        launchctl unload "$PLIST" 2>/dev/null || true
    fi
    rm -f "$PLIST"
    info "Removed LaunchAgent plist."
else
    info "No LaunchAgent found — skipping."
fi

if [ -d "$SUPPORT_DIR" ]; then
    info "Removing support directory..."
    rm -rf "$SUPPORT_DIR"
fi

# ── Remove plugin from app.asar ───────────────────────────────────────────────

if [ ! -d "$DRAWIO_APP" ]; then
    warn "draw.io not found at $DRAWIO_APP — skipping asar cleanup."
    warn "If you reinstall draw.io, no further action is needed: the plugin is gone."
elif ! command -v node &>/dev/null; then
    warn "Node.js not found — cannot remove plugin from app.asar."
    warn "Reinstalling draw.io from https://get.diagrams.net will give you a clean copy."
else
    if pgrep -x "draw.io" &>/dev/null; then
        info "Quitting draw.io..."
        osascript -e 'tell application "draw.io" to quit' 2>/dev/null || true
        sleep 2
    fi

    TMPDIR="$(mktemp -d)"
    trap 'rm -rf "$TMPDIR"' EXIT

    info "Extracting app.asar..."
    npx --yes @electron/asar extract "$ASAR" "$TMPDIR/asar"

    info "Removing tam-drawio.js from plugins..."
    rm -f "$TMPDIR/asar/drawio/src/main/webapp/plugins/tam-drawio.js"

    PRELOAD="$TMPDIR/asar/src/main/electron-preload.js"
    node - "$PRELOAD" <<'JSEOF'
const fs = require('fs');
const path = process.argv[2];
const src = fs.readFileSync(path, 'utf8');
if (!src.includes('tam-drawio')) {
    console.log('Preload not patched — skipping.');
    process.exit(0);
}
// The injection was prepended; the original file starts at 'const {'
const idx = src.indexOf('const {');
if (idx < 0) {
    console.error('Cannot find original preload boundary — skipping preload cleanup.');
    process.exit(0);
}
fs.writeFileSync(path, src.slice(idx));
console.log('Removed tam-drawio patch from electron-preload.js');
JSEOF

    info "Repacking app.asar..."
    npx @electron/asar pack "$TMPDIR/asar" "$ASAR"

    info "Re-registering app with LaunchServices..."
    "$LSREGISTER" -f "$DRAWIO_APP" 2>/dev/null || true
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}✓ tam-drawio plugin uninstalled.${NC}"
echo ""
echo "  The plugin and preload patch have been removed from draw.io."
echo "  The update watcher has been removed."
echo "  Note: the original Apple code signature cannot be restored."
echo "  Reinstall draw.io to get a fully signed copy."
echo ""
