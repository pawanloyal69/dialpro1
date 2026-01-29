# Dial Pro - Call & SMS Management System

A comprehensive Twilio-based calling and messaging platform with virtual numbers, call history, voicemail, and SMS functionality.

## Latest Updates (Jan 2026)

### 🐛 Critical Bug Fixes Applied

All major issues have been resolved:

✅ **Call History** - All calls now properly saved to history  
✅ **Voicemail Duration** - Correct duration now captured  
✅ **SMS History** - Messages properly tracked  
✅ **Call Functionality** - Make and receive calls working  
✅ **Voicemail Forwarding** - Unanswered calls route to voicemail  

See [FIXES_APPLIED.md](./FIXES_APPLIED.md) for technical details.

## Production Deployment

### Prerequisites

All environment variables must be configured on your hosting platform (Render, Vercel, etc.):

- MongoDB connection string
- Twilio credentials (Account SID, Auth Token, API Keys)
- JWT secrets
- Backend URL
- Frontend URL for CORS

**Note:** `.env` files are NOT included in this repository for security. Use `.env.example` files as templates.

### Backend (Render)

1. Set all environment variables in Render dashboard
2. Deploy from this GitHub repository
3. Verify all Twilio webhooks point to your Render URL

### Frontend (Vercel)

1. Set `REACT_APP_BACKEND_URL` in Vercel
2. Deploy from this GitHub repository
3. Ensure backend CORS includes your Vercel URL

## Documentation

- [FIXES_APPLIED.md](./FIXES_APPLIED.md) - Detailed bug fixes
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Deployment guide
- [backend/.env.example](./backend/.env.example) - Environment template

## Tech Stack

**Backend:**
- FastAPI (Python)
- MongoDB (Motor async driver)
- Twilio SDK
- JWT authentication
- WebSocket support

**Frontend:**
- React
- Twilio Client SDK
- Tailwind CSS
- Shadcn/ui components

## Features

- 📞 Virtual phone numbers
- 📱 Make and receive calls
- 💬 Send and receive SMS
- 📧 Voicemail with audio playback
- 📊 Call and message history
- 💰 Wallet system with billing
- 📦 Unlimited call plans
- 🔐 Secure authentication
- ⚡ Real-time WebSocket notifications

## Security

- JWT-based authentication
- Argon2 password hashing
- Twilio webhook signature validation
- CORS protection
- Environment variable configuration
- No secrets in repository

## License

Proprietary - All rights reserved

---

**Status:** ✅ Production Ready  
**Last Updated:** January 29, 2026
