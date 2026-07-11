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
        serviceAccountPath: path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'serviceAccountKey.json'),
    },

    storageChannel: process.env.STORAGE_CHANNEL || "@database72783",

    // Default Credit Settings
    credits: {
        perVerification: 1,
        perAd: 1,
        costPerDownload: 1
    },

    monetization: {
        monetagZoneId: process.env.MONETAG_ZONE_ID || "11203254",
        monetagUrl: process.env.MONETAG_URL || "https://omg10.com/4/11203254",
        gplinksApiKey: process.env.GPLINKS_API_KEY || "a1166b18fb3aad8dae0bd12b1151fad22993c366",
        miniAppUrl: process.env.MINI_APP_URL,
    },

    vip: {
        monthly: parseInt(process.env.VIP_MONTHLY) || 29,
        yearly: parseInt(process.env.VIP_YEARLY) || 299,
    },

    payment: {
        upiId: process.env.UPI_ID,
        paypalEmail: process.env.PAYPAL_EMAIL,
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
                if (settings.storageChannel) this.storageChannel = settings.storageChannel;
                if (settings.miniAppUrl) this.monetization.miniAppUrl = settings.miniAppUrl;
                if (settings.upiId) this.payment.upiId = settings.upiId;
                if (settings.paypalEmail) this.payment.paypalEmail = settings.paypalEmail;
                if (settings.forceJoinEnabled !== undefined) this.forceJoin.enabled = settings.forceJoinEnabled;
                if (settings.forceJoinChannel) this.forceJoin.channelId = settings.forceJoinChannel;
                if (settings.forceJoinLink) this.forceJoin.channelLink = settings.forceJoinLink;
                if (settings.vipMonthly) this.vip.monthly = parseInt(settings.vipMonthly);
                if (settings.vipYearly) this.vip.yearly = parseInt(settings.vipYearly);
                if (settings.monetagZoneId) this.monetization.monetagZoneId = settings.monetagZoneId;
                if (settings.monetagUrl) this.monetization.monetagUrl = settings.monetagUrl;
                if (settings.urlshortxApiKey) this.monetization.gplinksApiKey = settings.urlshortxApiKey;

                // Load Credit settings if available in DB
                if (settings.rewardVerification) this.credits.perVerification = parseInt(settings.rewardVerification);
                if (settings.rewardAd) this.credits.perAd = parseInt(settings.rewardAd);
                if (settings.downloadCost) this.credits.costPerDownload = parseInt(settings.downloadCost);
            }
        } catch (error) {
            console.error('Failed to load dynamic settings:', error.message);
        }
    }
};

if (!config.botToken) throw new Error('BOT_TOKEN is missing in .env');
module.exports = config;
