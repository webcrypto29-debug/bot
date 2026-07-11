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

            if (!baseUrl) return ctx.answerCbQuery("⚠️ BASE_URL not set in .env!", { show_alert: true });
            if (!config.monetagZoneId) return ctx.answerCbQuery("⚠️ MONETAG_ZONE_ID not set!", { show_alert: true });

            // 1. Generate unique session ID
            const sessionId = crypto.randomBytes(8).toString('hex').toUpperCase();

            // 2. Create session in DB
            await db.createAdSession(sessionId, userId);

            // 3. Construct the Web App / Page URL
            const adUrl = `${baseUrl}/ad?session=${sessionId}&file=${fileCode}`;

            const text = `📺 *Rewarded Advertisement*\n\n` +
                         `Watch the complete advertisement to earn Credits.\n` +
                         `Leaving early will NOT earn any Credits.\n\n` +
                         `⚠️ *Note:* Click the button below to start the ad.`;

            const kb = [
                [{ text: '▶️ Watch Ad Now', web_app: { url: adUrl } }],
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
