# Security Setup Guide

## Important: Environment Variables

This project uses environment variables to store sensitive credentials. **Never commit .env files to git!**

### Setup Instructions

#### Backend Setup
1. Copy the example file:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Edit `backend/.env` and add your actual credentials:
   - MongoDB connection string
   - Twilio credentials from https://console.twilio.com
   - JWT secret (generate a random string)
   - Backend URL (your Render deployment URL)

#### Frontend Setup
1. Copy the example file:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

2. Edit `frontend/.env` and update:
   - `REACT_APP_BACKEND_URL` with your backend URL

### Deployment

#### Render (Backend)
Add all environment variables from `backend/.env.example` in the Render dashboard:
- Go to your service → Environment tab
- Add each variable with actual values

#### Vercel (Frontend)  
Add environment variables in Vercel dashboard:
- Go to your project → Settings → Environment Variables
- Add `REACT_APP_BACKEND_URL` with your backend URL

### Security Notes

✅ **DO:**
- Keep .env files local only
- Use .env.example files with placeholder values
- Store real credentials in deployment platform (Render/Vercel)
- Rotate credentials if accidentally exposed

❌ **DON'T:**
- Commit .env files to git
- Share credentials in chat/email
- Hardcode credentials in source code
- Push sensitive data to public repositories

### If Credentials Are Exposed

1. **Immediately rotate** all exposed credentials:
   - Twilio: Generate new API keys
   - MongoDB: Change password
   - JWT: Generate new secret

2. **Check git history** for leaked secrets:
   ```bash
   git log --all --full-history -- "*.env"
   ```

3. **Remove from git history** if found:
   ```bash
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch backend/.env" \
   --prune-empty --tag-name-filter cat -- --all
   ```

### GitHub Secret Scanning

GitHub automatically scans for exposed secrets. If blocked:

1. Remove secrets from files
2. Use .env.example with placeholders
3. Ensure .env is in .gitignore
4. Commit changes and push

For more info: https://docs.github.com/code-security/secret-scanning/working-with-secret-scanning-and-push-protection
