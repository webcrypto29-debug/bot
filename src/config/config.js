const path = require('path');

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
        perAd: 5,
        costPerDownload: 1
    },

    monetization: {
        gplinksApiKey: process.env.GPLINKS_API_KEY || "a1166b18fb3aad8dae0bd12b1151fad22993c366",
        miniAppUrl: process.env.MINI_APP_URL,
    },

    forceJoin: {
        enabled: process.env.FORCE_JOIN_ENABLED === 'true',
        channelId: process.env.CHANNEL_ID || "@EricaUpdates",
        channelLink: process.env.CHANNEL_LINK || "https://t.me/EricaUpdates",
    },

    async loadDynamicSettings() {
        try {
            const dbService = require('../services/dbService');
            const settings = await dbService.getSettings();
            if (settings) {
                if (settings.miniAppUrl) this.monetization.miniAppUrl = settings.miniAppUrl;
                if (settings.rewardVerification) this.credits.perVerification = parseInt(settings.rewardVerification);
                if (settings.rewardAd) this.credits.perAd = parseInt(settings.rewardAd);
            }
        } catch (e) { console.error('Config load error'); }
    }
};

module.exports = config;
