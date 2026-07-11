const path = require('path');

/**
 * Production-ready Configuration for Erica File Bot
 */
const config = {
    botName: process.env.BOT_NAME || "Erica File Bot",
    botUsername: process.env.BOT_USERNAME || "Ericafilebot",
    botToken: process.env.BOT_TOKEN,
    adminIds: process.env.ADMIN_ID ? process.env.ADMIN_ID.split(',').map(id => parseInt(id.trim())) : [],

    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || "ericafilebot",
        serviceAccountPath: path.resolve(process.cwd(), 'serviceAccountKey.json'),
    },

    storageChannel: process.env.STORAGE_CHANNEL || "@database72783",

    credits: {
        perVerification: 7,
        perAd: 3,           // Mini App Reward
        perDirectLink: 2,   // Direct Link Reward
        costPerDownload: 1
    },

    monetization: {
        monetagZoneId: process.env.MONETAG_ZONE_ID || "11203254",
        monetagUrl: process.env.MONETAG_URL || "https://omg10.com/4/11203254",
        gplinksApiKey: process.env.GPLINKS_API_KEY || "a1166b18fb3aad8dae0bd12b1151fad22993c366",
        miniAppUrl: process.env.MINI_APP_URL,
    },

    forceJoin: {
        enabled: process.env.FORCE_JOIN_ENABLED === 'true',
        channelId: process.env.CHANNEL_ID || "@EricaUpdates",
        channelLink: process.env.CHANNEL_LINK || "https://t.me/EricaUpdates",
    },

    logLevel: process.env.LOG_LEVEL || 'info',

    async loadDynamicSettings() {
        try {
            const dbService = require('../services/dbService');
            const settings = await dbService.getSettings();
            if (settings) {
                if (settings.miniAppUrl) this.monetization.miniAppUrl = settings.miniAppUrl;
                if (settings.rewardVerification) this.credits.perVerification = parseInt(settings.rewardVerification);
                if (settings.rewardAd) this.credits.perAd = parseInt(settings.rewardAd);
                if (settings.rewardDirect) this.credits.perDirectLink = parseInt(settings.rewardDirect);
            }
        } catch (error) {
            console.error('Failed to load dynamic settings:', error.message);
        }
    }
};

if (!config.botToken) throw new Error('BOT_TOKEN is missing in .env');
module.exports = config;
