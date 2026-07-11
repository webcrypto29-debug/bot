const config = require('../config/config');
const dbService = require('../services/dbService');
const deliveryService = require('../services/deliveryService');

const activeTimers = new Map();

module.exports = (bot) => {
    // Menu when "Watch Ad" is clicked from Unlock Page
    bot.action(/^ad_(.*)$/, async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        const fileCode = ctx.match[1];
        const userId = ctx.from.id;
        const baseUrl = config.monetization.miniAppUrl;

        // Start 15s timer
        activeTimers.set(userId, { start: Date.now(), type: 'ad' });

        const text = `📺 *Rewarded Advertisement*\n\n` +
                     `Choose how you want to earn credits:\n\n` +
                     `1️⃣ *Mini App:* Watch full ad for *3 Credits*\n` +
                     `2️⃣ *Direct Link:* Watch in browser for *2 Credits*\n\n` +
                     `⏳ *Important:* You must wait at least 15 seconds before clicking Verify.`;

        const kb = [
            [{ text: '💎 Watch Ad Now (3 Cr)', web_app: { url: baseUrl ? `${baseUrl}/ad?file=${fileCode}` : '' } }],
            [{ text: '🔗 Direct Link (2 Cr)', url: config.monetization.monetagUrl }],
            [{ text: '⏱ Verify My Reward', callback_data: `verifyad_${fileCode}` }],
            [{ text: '🔙 Back', callback_data: `file_${fileCode}` }]
        ];

        if (!baseUrl) kb.shift(); // Remove mini app if no URL

        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    });

    // Verification Logic for Ads (Timer)
    bot.action(/^verifyad_(.*)$/, async (ctx) => {
        const fileCode = ctx.match[1];
        const userId = ctx.from.id;
        const state = activeTimers.get(userId);

        if (!state) return ctx.answerCbQuery('❌ Click an ad button first!', { show_alert: true });

        const elapsed = (Date.now() - state.start) / 1000;
        if (elapsed < 15) {
            const rem = Math.ceil(15 - elapsed);
            return ctx.answerCbQuery(`❌ Wait ${rem}s more!`, { show_alert: true });
        }

        // Grant Credits (Defaulting to 2 for manual verification)
        const amount = 2;
        await dbService.addCredits(userId, amount);
        activeTimers.delete(userId);

        await ctx.reply(`✅ *Reward Added!*\n🎉 *+${amount} Credits* received.`, { parse_mode: 'Markdown' });

        if (fileCode !== 'direct') {
            const user = await dbService.getUser(userId);
            if (user && user.credits >= 1) {
                const delivered = await deliveryService.deliverFile(ctx, fileCode, userId);
                if (delivered) await dbService.deductCredit(userId);
            }
        }
        ctx.answerCbQuery().catch(() => {});
    });

    // Handle standard earn options view
    bot.action('view_ads', (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        return bot.handleUpdate({ callback_query: { data: 'ad_direct', from: ctx.from, message: ctx.callbackQuery.message } });
    });
};
