# Erica File Bot 🚀

Erica File Bot is a professional, production-ready Telegram File Portal Bot built with **Node.js**, **Telegraf**, and **Firebase Firestore**. It features a robust link management system, multi-layer monetization (VIP, Ads, Shortlinks), and a modern Admin Dashboard.

## Features

- **File Portal**: Forward files from a private storage channel to generate unique, secure links.
- **Advanced Link Management**:
  - Permanent & Temporary links.
  - Custom Expiry dates.
  - One-time or Limited download links.
  - Enable/Disable links instantly.
- **Monetization Engine**:
  - **VIP System**: Subscription-based ad-free access (₹29/month, ₹299/year).
  - **Ads Integration**: Unlock files for 24 hours via Monetag.
  - **Shortlinks**: Unlock files for 3 days via URLShortX.
- **Admin Dashboard**: Real-time statistics, Revenue tracking, Broadcast system, and Firestore Data Backup.
- **Security**: Force Join (Required membership), Rate Limiting, Anti-Spam, and strict source channel validation (@database72783).

---

## 🛠 Installation & Setup

### 1. Prerequisites
- Node.js (v18+)
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- A Firebase Project with Firestore enabled.

### 2. Configuration
1. Clone the repository and navigate to the folder.
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example`:
   ```env
   BOT_TOKEN=8948840747:AAFJ...
   BOT_USERNAME=Ericafilebot
   ADMIN_ID=5911965767
   FIREBASE_PROJECT_ID=filebot-e30d6
   STORAGE_CHANNEL=@database72783
   ```
4. Place your Firebase `serviceAccountKey.json` in the root directory.

---

## 🚀 Deployment

### Linux (Ubuntu/Debian)
1. Install Node.js and PM2: `sudo apt install nodejs && npm install pm2 -g`
2. Start the bot: `pm2 start src/index.js --name erica-bot`
3. Save PM2 state: `pm2 save && pm2 startup`

### Termux (Android)
1. Install requirements: `pkg install nodejs git`
2. Clone and install: `git clone ... && cd ... && npm install`
3. Run: `node src/index.js`

### Windows
1. Install Node.js from [nodejs.org](https://nodejs.org).
2. Open CMD in the project folder.
3. Run: `npm install` and `npm start`.

---

## 📁 Folder Structure
- `src/handlers/`: Event handlers (User, Admin, Payments, etc.)
- `src/services/`: Business and Database logic.
- `src/middlewares/`: Auth, Access, and Rate Limiting.
- `src/database/`: Firestore initialization.
- `src/config/`: Dynamic and Static configuration.
- `src/utils/`: Helpers and Logging.

---

## 📜 Admin Commands
- `/admin`: Open the Modern Admin Panel.
- `/generate`: Start the link generation flow.
- `/profile`: View your user status.

## ⚖️ License
Licensed under the ISC License.
