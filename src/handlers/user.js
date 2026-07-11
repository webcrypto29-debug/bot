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

        // Handle Ad/Verification Rewards
        if (payload && (payload.startsWith('adsuccess_') || payload.startsWith('verify_'))) {
            const isAd = payload.startsWith('adsuccess_');
            const fileCode = payload.split('_')[1];
            const rewardAmount = isAd ? (config.credits?.perAd || 1) : (config.credits?.perVerification || 1);

            await dbService.addCredits(userId, rewardAmount);
            await ctx.reply(`✅ *${isAd ? 'Ad' : 'Verification'} Completed!*\n🎉 *+${rewardAmount} Credit* added to your balance.`, { parse_mode: 'Markdown' });

            if (fileCode !== 'direct') {
                const freshUser = await dbService.getUser(userId);
                if (freshUser.credits >= (config.credits?.costPerDownload || 1)) {
                    const delivered = await deliveryService.deliverFile(ctx, fileCode, userId);
                    if (delivered) await dbService.deductCredit(userId);
                }
            }
            return;
        }

        // Handle File Access Links
        if (payload) {
            if (credits >= (config.credits?.costPerDownload || 1) || isAdmin) {
                const delivered = await deliveryService.deliverFile(ctx, payload, userId);
                if (delivered && !isAdmin) await dbService.deductCredit(userId);
            } else {
                return showUnlockPage(ctx, payload, credits);
            }
            return;
        }

        // Welcome Message (Premium Look)
        let text = `👋 *Welcome to ${config.botName}*\n\n` +
                   `💰 *Your Balance:* \`${credits} Credits\`\n` +
                   `🆔 *User ID:* \`${userId}\`\n\n` +
                   `📢 *Updates:* ${config.forceJoin.channelId}`;

        const btns = [
            [{ text: '💎 Earn Credits', callback_data: 'earn_options' }, { text: '👤 My Profile', callback_data: 'user_profile' }],
            [{ text: '📢 Join Updates', url: config.forceJoin.channelLink }]
        ];

        if (isAdmin) btns.unshift([{ text: '🛠 Admin Dashboard', callback_data: 'admin_panel_start' }]);

        return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
    });

    const showUnlockPage = async (ctx, fileCode, credits) => {
        const text = `🔓 *Unlock Your File*\n\n` +
                     `To download this file, you need Credits.\n` +
                     `Each download consumes *1 Credit*.\n\n` +
                     `💰 *Your Credits:* \`${credits}\`\n\n` +
                     `*Choose an option below to earn credits:*`;

        const kb = [
            [{ text: '🔗 Option 1: Verification', callback_data: 'none' }],
            [{ text: '🔓 Open Verification', callback_data: `sl_${fileCode}` }, { text: '🔄 Try Again', callback_data: `file_${fileCode}` }],
            [{ text: '📺 Option 2: Watch Rewarded Ad', callback_data: 'none' }],
            [{ text: '▶ Watch Ad Now', callback_data: `ad_${fileCode}` }, { text: '✅ Verify Ad', callback_data: `verifyad_${fileCode}` }],
            [{ text: '🔙 Back to Menu', callback_data: 'user_back' }]
        ];

        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        } else {
            await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        }
    };

    bot.action('earn_options', async (ctx) => {
        const user = await dbService.getUser(ctx.from.id) || { credits: 0 };
        const text = `💎 *Earn Credits Menu*\n\n` +
                     `Current Balance: \`${user.credits} Credits\`\n\n` +
                     `Select a method to earn credits:`;
        const kb = [
            [{ text: '🔗 Verification (+1)', callback_data: 'sl_direct' }],
            [{ text: '📺 Watch Ad (+1)', callback_data: 'ad_direct' }],
            [{ text: '🔙 Back', callback_data: 'user_back' }]
        ];
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    });

    bot.action('user_profile', async (ctx) => {
        const user = await dbService.getUser(ctx.from.id) || { credits: 0 };
        const text = `👤 *Your Profile*\n\n` +
                     `💰 *Balance:* \`${user.credits} Credits\`\n` +
                     `🆔 *ID:* \`${ctx.from.id}\`\n` +
                     `👑 *Status:* ${config.adminIds.includes(ctx.from.id) ? 'Admin' : 'User'}`;
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'user_back' }]] } });
    });

    bot.action('user_back', async (ctx) => {
        await ctx.deleteMessage();
        // Trigger /start again
        return bot.handleUpdate({ message: { text: '/start', from: ctx.from, chat: ctx.chat, date: Date.now()/1000 }, update_id: 0 });
    });

    bot.action(/^file_(.*)$/, async (ctx) => {
        const fileCode = ctx.match[1];
        const user = await dbService.getUser(ctx.from.id);
        if (user && user.credits >= (config.credits?.costPerDownload || 1)) {
            const delivered = await deliveryService.deliverFile(ctx, fileCode, ctx.from.id);
            if (delivered) {
                await dbService.deductCredit(ctx.from.id);
                await ctx.deleteMessage();
            }
        } else {
            await ctx.answerCbQuery('❌ Verification not completed.', { show_alert: true });
        }
    });
};
