#!/bin/bash
# Syncs Swift source files from the Golf-Score repo into the Xcode project.
# Run this after pulling changes that modify watchos/Sources/GolfDistance/*.swift
# Usage: bash scripts/sync-watch-files.sh

XCODE_DIR="/Users/eyebridges/repos/GolfDistance/GolfDistance Watch App"
SOURCE_DIR="$(dirname "$0")/../watchos/Sources/GolfDistance"

if [ ! -d "$XCODE_DIR" ]; then
  echo "❌ Xcode project not found at: $XCODE_DIR"
  exit 1
fi

cp "$SOURCE_DIR"/*.swift "$XCODE_DIR/"
echo "✅ Synced Swift files to Xcode project. Open Xcode and hit ▶ Run."
