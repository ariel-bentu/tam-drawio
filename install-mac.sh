#!/bin/bash
# Installs tam-drawio plugin into draw.io Desktop on macOS.
#
# Works with draw.io Desktop v31.5.3+ (which removed the --enable-plugins flag).
# After installation, open draw.io normally — no special launcher needed.
#
# Also installs a LaunchAgent that watches for draw.io updates and prompts to
# reinstall the plugin when the app is updated.
#
# Re-run this script after each draw.io update (or let the watcher prompt you).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_JS="$SCRIPT_DIR/tam-drawio.js"
DRAWIO_APP="/Applications/draw.io.app"
ASAR="$DRAWIO_APP/Contents/Resources/app.asar"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

# When running under sudo, install the watcher for the original user (not root)
TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(eval echo "~$TARGET_USER")
SUPPORT_DIR="$TARGET_HOME/Library/Application Support/tam-drawio"
LAUNCH_AGENTS_DIR="$TARGET_HOME/Library/LaunchAgents"
CHECK_SCRIPT="$SUPPORT_DIR/check-plugin.sh"
PLIST="$LAUNCH_AGENTS_DIR/io.tam-drawio.watcher.plist"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

info()  { echo -e "${GREEN}▸${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
error() { echo -e "${RED}✖${NC}  $*" >&2; }

# Check if disclaimer was already accepted (passed through from first run before sudo re-exec)
ACCEPTED=0
for arg in "$@"; do [ "$arg" = "--accepted" ] && ACCEPTED=1; done

# ── Disclaimer ───────────────────────────────────────────────────────────────

if [ "$ACCEPTED" -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}DISCLAIMER${NC}"
    echo "  This script modifies the draw.io Desktop application bundle by:"
    echo "    • Injecting the tam-drawio plugin into its built-in plugins folder"
    echo "    • Patching its startup code to load the plugin automatically"
    echo "    • Removing the app's Apple code signature"
    echo ""
    echo "  As a result, draw.io will run as an unsigned application."
    echo "  Apple's code-signing verification and notarization will no longer"
    echo "  apply to this installation. This reduces the security guarantees"
    echo "  that macOS normally provides for this app."
    echo ""
    echo "  The tam-drawio project and its contributors accept no liability"
    echo "  for any issues arising from this modification, including but not"
    echo "  limited to security vulnerabilities, data loss, or app instability."
    echo ""
    echo "  Proceed only if you understand and accept these terms."
    echo ""
    read -r -p "  Type 'yes' to continue, anything else to cancel: " CONFIRM
    echo ""
    if [ "$CONFIRM" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

# ── Preflight ─────────────────────────────────────────────────────────────────

if [ ! -f "$PLUGIN_JS" ]; then
    error "Plugin not found: $PLUGIN_JS"
    error "Run this script from the tam-drawio repo directory, or clone it first:"
    error "  git clone https://github.com/ariel-bentu/tam-drawio"
    exit 1
fi

if [ ! -d "$DRAWIO_APP" ]; then
    error "draw.io Desktop not found at $DRAWIO_APP"
    error "Download it from: https://get.diagrams.net"
    exit 1
fi

if ! command -v node &>/dev/null; then
    error "Node.js is required. Install it from https://nodejs.org"
    exit 1
fi

# ── Quit draw.io ──────────────────────────────────────────────────────────────

if pgrep -x "draw.io" &>/dev/null; then
    info "Quitting draw.io..."
    osascript -e 'tell application "draw.io" to quit' 2>/dev/null || true
    sleep 2
fi

# ── Take ownership if needed ──────────────────────────────────────────────────
# If draw.io was installed from the official DMG/website it is root-owned.
# Homebrew Cask (brew install --cask drawio) installs user-owned — no prompt.

if [ ! -w "$ASAR" ]; then
    if [ "$EUID" -ne 0 ]; then
        echo ""
        warn "draw.io.app is owned by root (installed from DMG/website)."
        echo "  Re-running with sudo to gain write access..."
        echo "  Tip: install draw.io via Homebrew to avoid this entirely:"
        echo "       brew install --cask drawio"
        echo ""
        exec sudo bash "$0" "$@" --accepted
    fi
fi

# ── Remove code signature & clear Gatekeeper attributes ──────────────────────
# Leave the app unsigned — an unsigned app is handled more leniently by
# Gatekeeper than one with an ad-hoc signature that fails notarization.
# Without any signature the Hardened Runtime is not enforced, so Electron's
# V8 JIT works fine without entitlements.

info "Removing code signature..."
rm -rf "$DRAWIO_APP/Contents/_CodeSignature"

info "Clearing extended attributes (quarantine / Gatekeeper)..."
xattr -cr "$DRAWIO_APP"

# ── Patch app.asar ────────────────────────────────────────────────────────────

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

info "Extracting app.asar..."
npx --yes @electron/asar extract "$ASAR" "$TMPDIR/asar"

# Add the plugin file into the built-in plugins directory
info "Injecting tam-drawio.js into plugins..."
cp "$PLUGIN_JS" "$TMPDIR/asar/drawio/src/main/webapp/plugins/tam-drawio.js"

# Patch electron-preload.js to auto-register the plugin in localStorage.
# The preload runs before App.main() reads mxSettings, so this guarantees
# ./plugins/tam-drawio.js is always in the plugins list without any UI step.
PRELOAD="$TMPDIR/asar/src/main/electron-preload.js"
node - "$PRELOAD" <<'JSEOF'
const fs = require('fs');
const path = process.argv[2];
const src = fs.readFileSync(path, 'utf8');

if (src.includes('tam-drawio')) {
    console.log('Preload already patched — skipping.');
    process.exit(0);
}

const inject = `
// tam-drawio: register plugin in draw.io settings on every launch.
// Mirrors the adaptive-colors migration pattern already in this file.
try {
    const raw = window.localStorage.getItem('.drawio-config');
    const cfg = raw ? JSON.parse(raw) : {};
    if (!Array.isArray(cfg.plugins)) cfg.plugins = [];
    const entry = './plugins/tam-drawio.js';
    if (!cfg.plugins.includes(entry)) {
        cfg.plugins.push(entry);
        window.localStorage.setItem('.drawio-config', JSON.stringify(cfg));
    }
} catch (e) {
    console.error('tam-drawio: failed to register plugin', e);
}
`;

fs.writeFileSync(path, inject + '\n' + src);
console.log('Patched electron-preload.js');
JSEOF

info "Repacking app.asar..."
npx @electron/asar pack "$TMPDIR/asar" "$ASAR"

# ── Re-register with LaunchServices ──────────────────────────────────────────

info "Re-registering app with LaunchServices..."
"$LSREGISTER" -f "$DRAWIO_APP" 2>/dev/null || true

# ── Install update watcher ────────────────────────────────────────────────────
# A LaunchAgent watches app.asar for changes (draw.io updates) and prompts
# the user to reinstall the plugin via a native macOS dialog.

info "Installing update watcher..."

mkdir -p "$SUPPORT_DIR" "$LAUNCH_AGENTS_DIR"

# Write the check script (path to install-mac.sh baked in at install time)
cat > "$CHECK_SCRIPT" << CHECKEOF
#!/bin/bash
# Checks whether the tam-drawio patch is still present after a draw.io update.
# Triggered automatically by the io.tam-drawio.watcher LaunchAgent.

ASAR="/Applications/draw.io.app/Contents/Resources/app.asar"
INSTALL_SCRIPT="$SCRIPT_DIR/install-mac.sh"

# Wait briefly for the update write to complete
sleep 3

[ -f "\$ASAR" ] || exit 0

# Use 'strings' (built-in macOS tool) to scan the asar for our patch marker
if strings "\$ASAR" 2>/dev/null | grep -q "tam-drawio"; then
    exit 0  # still patched, nothing to do
fi

# Patch is gone — show dialog
osascript << 'APPLESCRIPT'
set installScript to "$SCRIPT_DIR/install-mac.sh"
set dlg to display dialog "draw.io was updated and the TAM plugin needs to be reinstalled." & return & return & "Click \"Reinstall Now\" to restore it." ¬
    with title "TAM Plugin" ¬
    buttons {"Later", "Reinstall Now"} ¬
    default button "Reinstall Now" ¬
    with icon caution
if button returned of dlg is "Reinstall Now" then
    tell application "Terminal"
        activate
        do script "bash " & quoted form of installScript
    end tell
end if
APPLESCRIPT
CHECKEOF

chmod +x "$CHECK_SCRIPT"

# Set correct ownership if running as root
if [ "$EUID" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
    chown "$SUDO_USER" "$CHECK_SCRIPT" "$SUPPORT_DIR"
fi

# Write the LaunchAgent plist
cat > "$PLIST" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>io.tam-drawio.watcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$CHECK_SCRIPT</string>
    </array>
    <key>WatchPaths</key>
    <array>
        <string>/Applications/draw.io.app/Contents/Resources/app.asar</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$SUPPORT_DIR/watcher.log</string>
    <key>StandardErrorPath</key>
    <string>$SUPPORT_DIR/watcher.log</string>
</dict>
</plist>
PLISTEOF

# Set correct ownership if running as root
if [ "$EUID" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
    chown "$SUDO_USER" "$PLIST" "$LAUNCH_AGENTS_DIR"
fi

# Load (or reload) the LaunchAgent as the target user
if [ "$EUID" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
    sudo -u "$SUDO_USER" launchctl unload "$PLIST" 2>/dev/null || true
    sudo -u "$SUDO_USER" launchctl load "$PLIST" 2>/dev/null || true
else
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST" 2>/dev/null || true
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}✓ tam-drawio plugin installed successfully!${NC}"
echo ""
echo "  Open draw.io normally — the plugin loads automatically."
echo "  No special launcher or command-line arguments needed."
echo ""
echo "  A background watcher will prompt you to reinstall"
echo "  if draw.io auto-updates and removes the plugin."
echo ""
