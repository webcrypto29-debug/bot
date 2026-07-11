const config = require('../config/config');
const dbService = require('../services/dbService');
const deliveryService = require('../services/deliveryService');

module.exports = (bot) => {
    // Handler for "Watch Ad Now" button
    bot.action(/^ad_(.*)$/, async (ctx) => {
        const fileCode = ctx.match[1];
        const baseUrl = config.monetization.miniAppUrl;

        if (!baseUrl) return ctx.answerCbQuery('⚠️ Ads not configured!', { show_alert: true });

        const url = `${baseUrl}/ad?file=${fileCode}`;

        try {
            const text = `📺 *Watch Rewarded Ad*\n\n` +
                         `Watch the complete advertisement (approx 15-30s) to earn *${config.credits.perAd} Credit*.\n\n` +
                         `⚠️ *Warning:* Closing the ad early will NOT grant any credits.`;

            const kb = [
                [{ text: '▶ Watch Ad Now', web_app: { url: url } }],
                [{ text: '✅ Verify Ad', callback_data: `verifyad_${fileCode}` }],
                [{ text: '🔙 Back', callback_data: 'earn_options' }]
            ];

            await ctx.reply(text, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: kb }
            });
        } catch (e) {
            console.error('Ad display error:', e.message);
        }
    });

    // Manual Verify Button for Ads
    bot.action(/^verifyad_(.*)$/, async (ctx) => {
        const fileCode = ctx.match[1];
        const userId = ctx.from.id;

        // In a more secure system, we would check a temporary token.
        // For now, we assume if they reach this point, they've tried.
        // The real credit is given via the auto-redirect from ad.html to bot.start(adsuccess_...)

        await ctx.answerCbQuery('⏳ Checking ad status...', { show_alert: false });

        // Check current credits
        const user = await dbService.getUser(userId);
        if (user.credits >= (config.credits?.costPerDownload || 1) && fileCode !== 'direct') {
            const delivered = await deliveryService.deliverFile(ctx, fileCode, userId);
            if (delivered) {
                await dbService.deductCredit(userId);
                await ctx.reply('✅ *Credits verified. Delivering file...*', { parse_mode: 'Markdown' });
            }
        } else {
            await ctx.reply('❌ *Ad completion not detected.*\n\nMake sure you watched the whole ad and returned to the bot via the "Done" button.', { parse_mode: 'Markdown' });
        }
    });
};
