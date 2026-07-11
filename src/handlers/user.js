const config = require('../config/config');
const deliveryService = require('../services/deliveryService');
const dbService = require('../services/dbService');

module.exports = (bot) => {
    const showMainMenu = async (ctx, isEdit = false) => {
        const user = await dbService.getUser(ctx.from.id) || { credits: 0 };
        const credits = user.credits || 0;
        const isAdmin = config.adminIds.includes(ctx.from.id);

        const text = `👋 *Welcome to ${config.botName}*\n\n` +
                     `💰 *Your Balance:* \`${credits} Credits\`\n` +
                     `🆔 *User ID:* \`${ctx.from.id}\`\n\n` +
                     `🎁 *Earn credits to unlock premium files!*`;

        const btns = [
            [{ text: '💎 Earn Credits', callback_data: 'earn_options' }, { text: '👤 Profile', callback_data: 'user_profile' }],
            [{ text: '📢 Updates', url: config.forceJoin.channelLink }]
        ];
        if (isAdmin) btns.unshift([{ text: '🛠 Admin Dashboard', callback_data: 'admin_panel_start' }]);

        if (isEdit) return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } }).catch(() => {});
        return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
    };

    bot.start(async (ctx) => {
        await config.loadDynamicSettings();
        const payload = ctx.payload;

        // Reward Payloads
        if (payload && (payload.startsWith('adsuccess_') || payload.startsWith('verify_'))) {
            const isAd = payload.startsWith('adsuccess_');
            const reward = isAd ? 3 : 7;
            await dbService.addCredits(ctx.from.id, reward);
            await ctx.reply(`✅ *Reward Received!*\n🎉 *+${reward} Credits* added to your balance.`, { parse_mode: 'Markdown' });
            return;
        }

        // File Access Payload
        if (payload) {
            const user = await dbService.getUser(ctx.from.id) || { credits: 0 };
            const isAdmin = config.adminIds.includes(ctx.from.id);
            if (user.credits >= 1 || isAdmin) {
                const sent = await deliveryService.deliverFile(ctx, payload, ctx.from.id);
                if (sent && !isAdmin) await dbService.deductCredit(ctx.from.id);
            } else {
                return showUnlockPage(ctx, payload, user.credits);
            }
            return;
        }
        return showMainMenu(ctx);
    });

    const showUnlockPage = async (ctx, fileCode, credits) => {
        if (ctx.callbackQuery) ctx.answerCbQuery().catch(() => {});
        const text = `🔓 *Unlock Your File*\n\n` +
                     `You need credits to access this file. 1 Download = 1 Credit.\n\n` +
                     `💰 *Balance:* \`${credits} Credits\`\n\n` +
                     `👇 *Earn credits below:*`;
        const kb = [
            [{ text: '🔗 Option 1: Verification (+7 Cr)', callback_data: `sl_${fileCode}` }],
            [{ text: '📺 Option 2: Watch Ad (+3/5 Cr)', callback_data: `ad_${fileCode}` }],
            [{ text: '🔄 Check Balance & Download', callback_data: `file_${fileCode}` }],
            [{ text: '🔙 Back to Menu', callback_data: 'user_back' }]
        ];
        if (ctx.callbackQuery) await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        else await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    };

    bot.action('user_back', (ctx) => showMainMenu(ctx, true));
    bot.action('user_profile', async (ctx) => {
        const user = await dbService.getUser(ctx.from.id) || { credits: 0 };
        const text = `👤 *My Profile*\n\n💰 Balance: \`${user.credits}\` Credits\n🆔 ID: \`${ctx.from.id}\``;
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'user_back' }]] } });
    });
};
