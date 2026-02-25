#!/bin/bash
# Script to push changes to GitHub

echo "🚀 Preparing to push changes to GitHub..."
echo ""

# Check if git is configured
if [ -z "$(git config user.name)" ] || [ -z "$(git config user.email)" ]; then
  echo "⚠️  Git user not configured"
  echo "Run these commands first:"
  echo "  git config user.name 'Your Name'"
  echo "  git config user.email 'your@email.com'"
  exit 1
fi

# Show current changes
echo "📋 Files to be committed:"
git status --short
echo ""

# Add all changes
echo "➕ Adding all changes..."
git add -A

# Commit with a message
echo ""
echo "💬 Enter commit message (or press Enter for default 'Update providers and UI'):"
read -r message
if [ -z "$message" ]; then
  message="Update providers and UI: implement 8 bridge providers, add logo, fix quote fetching"
fi

git commit -m "$message"
echo ""

# Check if GitHub CLI is authenticated
echo "🔐 Checking GitHub authentication..."
if gh auth status >/dev/null 2>&1; then
  echo "✅ GitHub CLI is authenticated"
  echo ""
  echo "📤 Pushing to GitHub..."
  git push origin main
else
  echo "⚠️  GitHub CLI not authenticated"
  echo ""
  echo "You have 2 options:"
  echo ""
  echo "Option A - GitHub CLI (recommended):"
  echo "  1. Run: gh auth login"
  echo "  2. Follow the prompts (select HTTPS, then paste a token)"
  echo "  3. Run this script again"
  echo ""
  echo "Option B - Personal Access Token:"
  echo "  1. Go to: https://github.com/settings/tokens"
  echo "  2. Generate a new token with 'repo' scope"
  echo "  3. Run: git push origin main"
  echo "  4. Enter your GitHub username and token as password"
  echo ""
fi
