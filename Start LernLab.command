#!/bin/bash
# Double-click this file in Finder to start LernLab and open it in your browser.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  [ -d "$HOME/.local/bin" ] && export PATH="$HOME/.local/bin:$PATH"
  [ -d /opt/homebrew/bin ] && export PATH="/opt/homebrew/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Get version 22 or newer from https://nodejs.org" ; read -r ; exit 1
fi
if [ ! -d node_modules ]; then
  echo "First run: installing (one minute)…"
  npm install --no-fund --no-audit || { read -r ; exit 1; }
fi
# If LernLab is already running, just open it.
if curl -s -o /dev/null http://localhost:5179/api/state; then
  open "http://localhost:5179/#start"; exit 0
fi
npm run build --silent
(sleep 2; open "http://localhost:5179/#start") &
npm run serve
