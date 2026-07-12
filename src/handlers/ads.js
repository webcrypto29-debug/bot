const config = require('../config/config');
const db = require('../services/db');
const crypto = require('crypto');

module.exports = (bot) => {
    // When user clicks "📺 Watch Rewarded Ad" button from Unlock Page
    bot.action(/^watch_(.*)$/, async (ctx) => {
        try {
            const fileCode = ctx.match[1];
            const userId = ctx.from.id;
            const baseUrl = config.baseUrl;
            const isAdmin = config.adminIds.includes(userId);

            if (!config.monetagZoneId) {
                if (isAdmin) {
                    return ctx.answerCbQuery("⚠️ MONETAG_ZONE_ID not set in .env!", { show_alert: true });
                } else {
                    return ctx.answerCbQuery("❌ This feature is currently unavailable.", { show_alert: false });
                }
            }

            // 1. Generate unique session ID
            const sessionId = crypto.randomBytes(8).toString('hex').toUpperCase();

            // 2. Create session in DB
            await db.createAdSession(sessionId, userId);

            // 3. Construct the Web App / Page URL
            // Fallback to Blogger if BASE_URL is missing
            let adUrl;
            let isWebApp = true;

            if (!baseUrl) {
                adUrl = `https://monetagad5367.blogspot.com/p/reward.html?session=${sessionId}&file=${fileCode}&bot=${config.botUsername}`;
                isWebApp = false;
            } else {
                adUrl = `${baseUrl}/ad?session=${sessionId}&file=${fileCode}`;
            }

            const text = `📺 *Rewarded Advertisement*\n\n` +
                         `Watch the complete advertisement to earn Credits.\n` +
                         `Leaving early will NOT earn any Credits.\n\n` +
                         `⚠️ *Note:* Click the button below to start the ad.`;

            const kb = [
                isWebApp ? [{ text: '▶️ Watch Ad Now', web_app: { url: adUrl } }] : [{ text: '▶️ Watch Ad Now', url: adUrl }],
                [{ text: '🔙 Cancel', callback_data: 'main' }]
            ];

            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
            await ctx.answerCbQuery();

        } catch (e) {
            console.error("Ad handler error:", e);
            ctx.answerCbQuery("❌ Error initializing ad.");
        }
    });
};
