#!/bin/bash
set -e

echo "Starting release process for tars-ai-cli"

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Error: Please switch to main branch before releasing"
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Working directory is not clean. Please commit or stash changes."
    exit 1
fi

echo "Pulling latest changes..."
git pull origin main

echo "Installing dependencies..."
bun install --frozen-lockfile

echo "Building project..."
bun run build

if [ ! -f "dist/index.js" ]; then
    echo "Error: Build failed — dist/index.js not found"
    exit 1
fi

echo "What type of release is this?"
echo "1) patch (bug fixes)"
echo "2) minor (new features)"
echo "3) major (breaking changes)"
read -p "Enter choice (1-3): " choice

case $choice in
    1) VERSION_TYPE="patch";;
    2) VERSION_TYPE="minor";;
    3) VERSION_TYPE="major";;
    *) echo "Error: Invalid choice"; exit 1;;
esac

echo "Bumping $VERSION_TYPE version..."
npm version $VERSION_TYPE

NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

echo "Pushing changes and tags..."
git push origin main --tags

echo "Done. GitHub Actions will publish to npm once the tag is pushed."
echo "Track progress at: https://github.com/acegikmoo/tars/actions"
