const config = require('../config/config');
const axios = require('axios');

module.exports = (bot) => {
    // Handler for "Verification" button (Shortlink)
    bot.action(/^sl_(.*)$/, async (ctx) => {
        const fileCode = ctx.match[1];
        const userId = ctx.from.id;
        const apiKey = config.monetization.gplinksApiKey;

        // Link to return to bot with reward payload
        const returnLink = `https://t.me/${config.botUsername}?start=verify_${fileCode}`;

        try {
            const res = await axios.get(`https://gplinks.in/api?api=${apiKey}&url=${encodeURIComponent(returnLink)}`);
            if (res.data.shortenedUrl) {
                await ctx.answerCbQuery('🔗 Verification Link Generated');
                const text = `🔗 *Verification Required*\n\n` +
                             `Complete this verification to earn *${config.credits.perVerification} Credit* and unlock your content.\n\n` +
                             `⚠️ *Note:* You must reach the final page to receive the credit.`;

                const kb = [
                    [{ text: '🔓 Open Verification', url: res.data.shortenedUrl }],
                    [{ text: '🔄 Try Again', callback_data: `sl_${fileCode}` }],
                    [{ text: '🔙 Back', callback_data: 'earn_options' }]
                ];

                await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
            }
        } catch (e) {
            console.error('Shortlink API Error:', e.message);
            await ctx.answerCbQuery('❌ API Error. Please try Ads.', { show_alert: true });
        }
    });
};
