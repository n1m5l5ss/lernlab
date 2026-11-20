#!/bin/bash
# Optional: start LernLab automatically when you log in (macOS LaunchAgent).
#   ./scripts/autostart.sh install    – start at login, keep running
#   ./scripts/autostart.sh uninstall  – remove it
set -e
LABEL=dev.lernlab.server
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM="$(command -v npm)"
case "$1" in
  install)
    (cd "$DIR" && npm run build --silent)
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>ProgramArguments</key><array><string>$NPM</string><string>run</string><string>serve</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$NPM"):/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/data/server.log</string>
  <key>StandardErrorPath</key><string>$DIR/data/server.log</string>
</dict></plist>
PL
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "LernLab now starts at login → http://localhost:5179" ;;
  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Removed." ;;
  *) echo "Usage: $0 install|uninstall" ;;
esac
