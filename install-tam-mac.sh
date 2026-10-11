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

CERT_NAME="TAM draw.io Plugin Signing"
CERT_KEYCHAIN="$TARGET_HOME/Library/Keychains/login.keychain-db"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

info()  { echo -e "${GREEN}▸${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
error() { echo -e "${RED}✖${NC}  $*" >&2; }

# Flags passed through sudo re-exec so we don't repeat first-time setup
ACCEPTED=0; CERT_READY=0
for arg in "$@"; do
    [ "$arg" = "--accepted"  ] && ACCEPTED=1
    [ "$arg" = "--cert-ready" ] && CERT_READY=1
done

# ── Self-owned signing certificate ────────────────────────────────────────────
# Creates a 10-year RSA-4096 code-signing cert in the user's login keychain the
# first time, then reuses it on subsequent installs.  Must be called as the
# real (non-root) user so the private key lands in their keychain.

ensure_signing_cert() {
    # Check for a usable code-signing identity (cert with codeSigning EKU)
    if security find-identity -v -p codesigning "$CERT_KEYCHAIN" 2>/dev/null \
            | grep -q "\"$CERT_NAME\""; then
        info "Reusing existing signing certificate."
        return 0
    fi

    # Cert may exist but lack the codeSigning EKU — remove it before recreating
    if security find-certificate -c "$CERT_NAME" "$CERT_KEYCHAIN" &>/dev/null; then
        info "Existing certificate cannot sign code — recreating with correct extensions..."
        security delete-certificate -c "$CERT_NAME" "$CERT_KEYCHAIN" 2>/dev/null || true
    fi

    info "Creating self-owned signing certificate (first-time setup)..."
    echo ""
    echo "  A private certificate named \"$CERT_NAME\" will be created"
    echo "  and added to your login keychain.  macOS will ask for your"
    echo "  login password to authorise trusting it for code signing."
    echo ""

    local CERT_DIR
    CERT_DIR="$(mktemp -d)"
    trap 'rm -rf "$CERT_DIR"' RETURN

    # Config file ensures the certificate carries the Code Signing EKU that
    # codesign requires.  Without it codesign refuses the identity entirely.
    cat > "$CERT_DIR/openssl.conf" << 'CONF'
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no

[dn]
CN = TAM draw.io Plugin Signing

[ext]
keyUsage = critical,digitalSignature
extendedKeyUsage = codeSigning
basicConstraints = critical,CA:FALSE
subjectKeyIdentifier = hash
CONF

    openssl req -x509 -newkey rsa:4096 \
        -keyout "$CERT_DIR/signing.key" \
        -out    "$CERT_DIR/signing.crt" \
        -days 3650 -nodes \
        -config "$CERT_DIR/openssl.conf" 2>/dev/null \
        || { error "Failed to generate certificate."; exit 1; }

    # Import cert and private key as PEM — avoids PKCS12 encryption
    # incompatibilities between OpenSSL 3.x and the macOS security tool.
    security import "$CERT_DIR/signing.crt" \
        -k "$CERT_KEYCHAIN" \
        || { error "Failed to import certificate into keychain."; exit 1; }

    # Import the private key; grant /usr/bin/codesign access without future prompts
    security import "$CERT_DIR/signing.key" \
        -k "$CERT_KEYCHAIN" \
        -T /usr/bin/codesign \
        || { error "Failed to import private key into keychain."; exit 1; }

    # Trust the certificate for code signing (prompts for login password)
    security add-trusted-cert \
        -r trustRoot \
        -k "$CERT_KEYCHAIN" \
        "$CERT_DIR/signing.crt" \
        || { error "Failed to trust certificate. Run the script again to retry."; exit 1; }

    info "Signing certificate created and trusted."
}

# ── Disclaimer ───────────────────────────────────────────────────────────────

if [ "$ACCEPTED" -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}DISCLAIMER${NC}"
    echo "  This script modifies the draw.io Desktop application bundle by:"
    echo "    • Injecting the tam-drawio plugin into its built-in plugins folder"
    echo "    • Patching its startup code to load the plugin automatically"
    echo "    • Re-signing the app with a self-owned certificate"
    echo ""
    echo "  On first run a private code-signing certificate is created and added"
    echo "  to your login keychain.  The app is then re-signed with it, so the"
    echo "  bundle is protected against further unauthorised modifications."
    echo ""
    echo "  The app will NOT be notarised by Apple, so macOS Gatekeeper will"
    echo "  accept it only on this machine (where the certificate is trusted)."
    echo "  Apple's own notarisation guarantees no longer apply."
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

# ── Signing certificate (must be set up as the real user before sudo) ────────

if [ "$CERT_READY" -eq 0 ] && [ "$EUID" -ne 0 ]; then
    ensure_signing_cert
fi

# ── Take ownership if needed ──────────────────────────────────────────────────
# If draw.io was installed from the official DMG/website it is root-owned.
# Homebrew Cask (brew install --cask drawio) installs user-owned — no prompt.

if [ ! -w "$ASAR" ]; then
    if [ "$EUID" -ne 0 ]; then
        echo ""
        warn "draw.io.app requires elevated access to modify."
        echo "  macOS seals signed app bundles, blocking writes even to user-owned files."
        echo "  Re-running with sudo to remove the seal before patching..."
        echo ""
        exec sudo bash "$0" "$@" --accepted --cert-ready
    fi
fi

# ── Remove Apple code signature & clear Gatekeeper attributes ────────────────
# Strip the original signature so we can re-sign with our own cert below.
# The quarantine xattr is cleared so Gatekeeper doesn't block first launch.

info "Removing Apple code signature..."
if ! rm -rf "$DRAWIO_APP/Contents/_CodeSignature" 2>/dev/null; then
    echo ""
    error "Cannot modify draw.io.app — macOS App Management permission is required."
    echo ""
    echo "  Grant your terminal app permission in:"
    echo "    System Settings → Privacy & Security → App Management"
    echo ""
    echo "  Then re-run this script."
    exit 1
fi

info "Clearing extended attributes (quarantine / Gatekeeper)..."
xattr -cr "$DRAWIO_APP" 2>/dev/null || true

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
npx @electron/asar pack "$TMPDIR/asar" "$TMPDIR/app.asar"
# Overwrite the existing ASAR in-place.
# App Management permits overwriting existing files but blocks creating new ones,
# so we must NOT delete the ASAR before copying.  The code-signing xattrs were
# cleared by xattr -cr above, so the file is now writable.
cp "$TMPDIR/app.asar" "$ASAR"
# Restore ownership so the real user can sign the bundle
chown "$TARGET_USER" "$ASAR"

# ── Re-sign app with self-owned certificate ───────────────────────────────────
# codesign without --options runtime keeps Hardened Runtime off, so Electron's
# V8 JIT works fine without entitlements.
# When running as root (DMG install), we point --keychain at the real user's
# login keychain where the private key was imported with -T /usr/bin/codesign.

info "Re-signing app with self-owned certificate..."
# codesign must run as the real user so it can reach their login keychain.
# The user owns Contents/ so they can create _CodeSignature/ there.
if [ "$EUID" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
    CODESIGN_USER="$TARGET_USER"
    RUN_CODESIGN=(sudo -u "$CODESIGN_USER" codesign --force --deep --sign "$CERT_NAME" --timestamp=none "$DRAWIO_APP")
else
    RUN_CODESIGN=(codesign --force --deep --sign "$CERT_NAME" --timestamp=none "$DRAWIO_APP")
fi

if "${RUN_CODESIGN[@]}" 2>&1; then
    info "App re-signed with \"$CERT_NAME\"."
else
    warn "Re-signing failed — the plugin is installed but the app runs unsigned."
    warn "To re-sign manually: codesign --force --deep --sign \"$CERT_NAME\" \"$DRAWIO_APP\""
fi

# ── Re-register with LaunchServices ──────────────────────────────────────────

info "Re-registering app with LaunchServices..."
"$LSREGISTER" -f "$DRAWIO_APP" 2>/dev/null || true

# ── Install update watcher ────────────────────────────────────────────────────
# A LaunchAgent watches app.asar for changes (draw.io updates) and prompts
# the user to reinstall the plugin via a native macOS dialog.

info "Installing update watcher..."

mkdir -p "$SUPPORT_DIR" "$LAUNCH_AGENTS_DIR"

# Write the check script (path to install-tam-mac.sh baked in at install time)
cat > "$CHECK_SCRIPT" << CHECKEOF
#!/bin/bash
# Checks whether the tam-drawio patch is still present after a draw.io update.
# Triggered automatically by the io.tam-drawio.watcher LaunchAgent.

ASAR="/Applications/draw.io.app/Contents/Resources/app.asar"
INSTALL_SCRIPT="$SCRIPT_DIR/install-tam-mac.sh"

# Wait briefly for the update write to complete
sleep 3

[ -f "\$ASAR" ] || exit 0

# Use 'strings' (built-in macOS tool) to scan the asar for our patch marker
if strings "\$ASAR" 2>/dev/null | grep -q "tam-drawio"; then
    exit 0  # still patched, nothing to do
fi

# Patch is gone — show dialog
osascript << 'APPLESCRIPT'
set installScript to "$SCRIPT_DIR/install-tam-mac.sh"
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
echo "  The app is signed with your self-owned certificate."
echo "  If draw.io auto-updates, a background watcher will prompt"
echo "  you to reinstall the plugin (and re-sign)."
echo ""
