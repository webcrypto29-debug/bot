const config = require('../config/config');
const axios = require('axios');

module.exports = (bot) => {
    bot.action(/^sl_(.*)$/, async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        const fileCode = ctx.match[1];
        const apiKey = config.monetization.gplinksApiKey;

        const returnLink = `https://t.me/${config.botUsername}?start=verify_${fileCode}`;

        try {
            const res = await axios.get(`https://gplinks.in/api?api=${apiKey}&url=${encodeURIComponent(returnLink)}`);
            if (res.data.shortenedUrl) {
                const text = `🔗 *Verification Required*\n\n` +
                             `Complete this task to earn *${config.credits.perVerification} Credits*.\n\n` +
                             `⚠️ Credits are only added after reaching the final destination.`;

                const kb = [
                    [{ text: '🔓 Open Verification', url: res.data.shortenedUrl }],
                    [{ text: '🔙 Back', callback_data: `file_${fileCode}` }]
                ];

                await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
            }
        } catch (e) {
            await ctx.answerCbQuery('❌ API Error. Try Ads.', { show_alert: true });
        }
    });

    bot.action('shortlink', (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        return bot.handleUpdate({ callback_query: { data: 'sl_direct', from: ctx.from, message: ctx.callbackQuery.message } });
    });
};
