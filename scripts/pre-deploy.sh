#!/bin/bash

# Script to bump version and prepare for deployment
# Usage: npm run pre-deploy

VERSIONFILE="public/version.json"

# Get current version
CURRENT_VERSION=$(cat $VERSIONFILE | grep '"version"' | head -1 | awk -F':' '{print $2}' | sed 's/[", ]//g')

# Bump patch version
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

# Get current date
BUILD_DATE=$(date +"%Y-%m-%d")

# Get current time in HH:MM:SS format
BUILD_TIME=$(date +"%H:%M:%S")

# Update version.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" $VERSIONFILE
sed -i '' "s/\"buildDate\": \".*\"/\"buildDate\": \"$BUILD_DATE\"/" $VERSIONFILE
sed -i '' "s/\"buildTime\": \".*\"/\"buildTime\": \"$BUILD_TIME\"/" $VERSIONFILE

echo "✅ Version bumped: $CURRENT_VERSION → $NEW_VERSION"
echo "📅 Build date: $BUILD_DATE"
echo "🕐 Build time: $BUILD_TIME"
echo ""
echo "Ready to deploy! Run: npm run build && npm run start"
