require('dotenv').config();
const path = require('path');

const config = {
    // Basic Telegram
    botToken: process.env.BOT_TOKEN,
    botUsername: process.env.BOT_USERNAME,
    adminIds: process.env.ADMIN_ID ? process.env.ADMIN_ID.split(',').map(id => parseInt(id.trim())) : [],

    // API Details
    apiId: process.env.API_ID,
    apiHash: process.env.API_HASH,

    // Firebase
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        keyPath: path.resolve(process.cwd(), 'serviceAccountKey.json')
    },

    // Storage
    storageChannel: process.env.STORAGE_CHANNEL || "@database72783",

    // Monetization
    monetagZoneId: process.env.MONETAG_ZONE_ID, // Loaded from .env
    baseUrl: process.env.BASE_URL,             // Loaded from .env (e.g. https://xyz.serveo.net)
    shortlinkApiKey: process.env.URLSHORTX_API_KEY,

    // Rewards & Cost
    rewards: {
        shortlink: 7,
        adReward: 5,        // Credits given for one rewarded ad
        costPerDownload: 1
    }
};

if (!config.botToken) throw new Error("CRITICAL: BOT_TOKEN is missing in your .env file!");
if (!config.monetagZoneId) console.warn("WARNING: MONETAG_ZONE_ID is missing in .env");

module.exports = config;
