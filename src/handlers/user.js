const config = require('../config/config');
const deliveryService = require('../services/deliveryService');
const dbService = require('../services/dbService');

module.exports = (bot) => {
    bot.start(async (ctx) => {
        await config.loadDynamicSettings();
        const userId = ctx.from.id;
        const payload = ctx.payload;
        const isAdmin = config.adminIds.includes(userId);

        const user = await dbService.getUser(userId) || { credits: 0 };
        const credits = user.credits || 0;

        // Reward Logic
        if (payload && (payload.startsWith('adsuccess_') || payload.startsWith('verify_'))) {
            const isAd = payload.startsWith('adsuccess_');
            const fileCode = payload.split('_')[1];
            const reward = isAd ? config.credits.perAd : config.credits.perVerification;

            await dbService.addCredits(userId, reward);
            await ctx.reply(`✅ *Reward Success!*\n🎉 *+${reward} Credits* added.`, { parse_mode: 'Markdown' });

            if (fileCode !== 'direct') {
                const freshUser = await dbService.getUser(userId);
                if (freshUser.credits >= config.credits.costPerDownload) {
                    const sent = await deliveryService.deliverFile(ctx, fileCode, userId);
                    if (sent) await dbService.deductCredit(userId);
                }
            }
            return;
        }

        // File Access
        if (payload) {
            if (credits >= config.credits.costPerDownload || isAdmin) {
                const delivered = await deliveryService.deliverFile(ctx, payload, userId);
                if (delivered && !isAdmin) await dbService.deductCredit(userId);
            } else {
                return showUnlockPage(ctx, payload, credits);
            }
            return;
        }

        // Welcome
        const welcomeText = `👋 *Welcome to ${config.botName}*\n\n💰 *Balance:* \`${credits} Credits\``;
        const btns = [
            [{ text: '💎 Earn Credits', callback_data: 'earn_options' }, { text: '👤 Profile', callback_data: 'user_profile' }],
            [{ text: '📢 Updates', url: config.forceJoin.channelLink }]
        ];
        if (isAdmin) btns.unshift([{ text: '🛠 Admin Panel', callback_data: 'admin_panel_start' }]);
        return ctx.reply(welcomeText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
    });

    const showUnlockPage = async (ctx, fileCode, credits) => {
        if (ctx.callbackQuery) ctx.answerCbQuery().catch(() => {});
        const text = `🔓 *Unlock Your File*\n\nYour Credits: \`${credits}\`\n\nChoose an option:`;
        const kb = [
            [{ text: '🔗 Option 1: Verification (+7)', callback_data: `sl_${fileCode}` }],
            [{ text: '📺 Option 2: Watch Ad (+5)', callback_data: `ad_${fileCode}` }],
            [{ text: '🔙 Back', callback_data: 'user_back' }]
        ];
        if (ctx.callbackQuery) await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        else await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    };

    bot.action('user_back', async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        await ctx.deleteMessage();
        return bot.handleUpdate({ message: { text: '/start', from: ctx.from, chat: ctx.chat, date: Date.now()/1000 }, update_id: 0 });
    });

    bot.action('earn_options', async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        const text = `💎 *Earn Credits Menu*\n\nChoose a method:`;
        const kb = [
            [{ text: '🔗 Verification (+7)', callback_data: 'sl_direct' }],
            [{ text: '📺 Watch Ad (+5)', callback_data: 'ad_direct' }],
            [{ text: '🔙 Back', callback_data: 'user_back' }]
        ];
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    });
};
