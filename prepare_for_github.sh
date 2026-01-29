#!/bin/bash

# Script to prepare project for GitHub push
# This removes sensitive environment files

echo "================================================"
echo "Preparing Dial Pro for GitHub Push"
echo "================================================"

# Check if .env file exists
if [ -f "/app/backend/.env" ]; then
    echo ""
    echo "⚠️  WARNING: Production .env file found!"
    echo "   Location: /app/backend/.env"
    echo ""
    echo "   This file contains production credentials:"
    echo "   - MongoDB connection string"
    echo "   - Twilio API keys"
    echo "   - JWT secret"
    echo "   - etc."
    echo ""
    echo "🔒 This file should NOT be committed to GitHub!"
    echo ""
    echo "Would you like to:"
    echo "  1) Create a backup and remove .env (recommended)"
    echo "  2) Just show the file (no changes)"
    echo "  3) Cancel"
    echo ""
    read -p "Enter choice (1/2/3): " choice
    
    case $choice in
        1)
            # Create backup
            cp /app/backend/.env /app/backend/.env.backup
            echo "✅ Backup created: /app/backend/.env.backup"
            
            # Remove .env
            rm /app/backend/.env
            echo "✅ Removed: /app/backend/.env"
            
            # Verify .env.example exists
            if [ -f "/app/backend/.env.example" ]; then
                echo "✅ Template available: /app/backend/.env.example"
            else
                echo "⚠️  Warning: .env.example not found"
            fi
            
            echo ""
            echo "✅ Project is now ready for GitHub push!"
            echo ""
            echo "Next steps:"
            echo "  1. git add ."
            echo "  2. git commit -m 'Fix: Resolved call history, voicemail, and SMS issues'"
            echo "  3. git push origin main"
            echo ""
            echo "Note: All credentials are already configured on Render."
            echo "      No additional configuration needed after push."
            ;;
        2)
            echo ""
            echo "Current .env file contents:"
            echo "-----------------------------------"
            head -5 /app/backend/.env
            echo "... (truncated for security)"
            echo "-----------------------------------"
            echo ""
            echo "⚠️  Remember to remove this before pushing to GitHub!"
            ;;
        3)
            echo "Cancelled. No changes made."
            ;;
        *)
            echo "Invalid choice. No changes made."
            ;;
    esac
else
    echo "✅ No .env file found in /app/backend/"
    echo "✅ Project is safe to push to GitHub"
fi

echo ""
echo "================================================"
echo "Checklist before GitHub push:"
echo "================================================"
echo "  [ ] .env file removed or backed up"
echo "  [ ] .env.example is present"
echo "  [ ] No other sensitive files in repo"
echo "  [ ] All fixes tested locally"
echo "  [ ] Documentation updated"
echo "================================================"
