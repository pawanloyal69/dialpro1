#!/bin/bash
# Script to remove .env files from git history

echo "⚠️  WARNING: This will rewrite git history!"
echo "Make sure you have a backup before proceeding."
echo ""
read -p "Do you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

cd /app/temp_dialpro

echo "📝 Removing backend/.env from git history..."
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

echo "📝 Removing frontend/.env from git history..."
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch frontend/.env" \
  --prune-empty --tag-name-filter cat -- --all

echo "🧹 Cleaning up..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "✅ Git history cleaned!"
echo ""
echo "Next steps:"
echo "1. Review changes: git log --oneline"
echo "2. Force push: git push --force origin main"
echo "3. Rotate Twilio credentials immediately!"
