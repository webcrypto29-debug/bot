const config = require('../config/config');
const dbService = require('../services/dbService');
const deliveryService = require('../services/deliveryService');

const activeTimers = new Map();

module.exports = (bot) => {
    bot.action(/^ad_(.*)$/, async (ctx) => {
        const fileCode = ctx.match[1];
        const userId = ctx.from.id;
        const baseUrl = config.monetization.miniAppUrl;

        // Start 15s timer
        activeTimers.set(userId, Date.now());

        const text = `📺 *Select Ad Type to Earn*\n\n` +
                     `1️⃣ *Watch Ad (Mini App):* Earn *3 Credits*\n` +
                     `2️⃣ *Direct Link (Browser):* Earn *2 Credits*\n\n` +
                     `⏳ *Note:* You must watch for 15 seconds before you can Verify.`;

        const kb = [
            [{ text: '💎 Watch Ad Now (3 Cr)', web_app: { url: `${baseUrl}/ad?file=${fileCode}` } }],
            [{ text: '🔗 Direct Link (2 Cr)', url: config.monetization.monetagUrl }],
            [{ text: '⏱ Verify & Get Credits', callback_data: `verifyad_${fileCode}` }],
            [{ text: '🔙 Back', callback_data: `file_${fileCode}` }]
        ];
        if (!baseUrl) kb.shift();

        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    });

    bot.action(/^verifyad_(.*)$/, async (ctx) => {
        const fileCode = ctx.match[1];
        const userId = ctx.from.id;
        const startTime = activeTimers.get(userId);

        if (!startTime) return ctx.answerCbQuery('❌ Click an ad first!', { show_alert: true });

        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed < 15) {
            const rem = Math.ceil(15 - elapsed);
            return ctx.answerCbQuery(`❌ Wait ${rem}s more!`, { show_alert: true });
        }

        // Grant 2 Credits for Manual Verification
        await dbService.addCredits(userId, 2);
        activeTimers.delete(userId);
        await ctx.reply('✅ *Ad Verified! +2 Credits added.*');

        if (fileCode !== 'direct') {
            const user = await dbService.getUser(userId);
            if (user.credits >= 1) {
                const delivered = await deliveryService.deliverFile(ctx, fileCode, userId);
                if (delivered) await dbService.deductCredit(userId);
            }
        }
    });
};
