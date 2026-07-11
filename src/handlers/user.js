const config = require('../config/config');
const deliveryService = require('../services/deliveryService');
const dbService = require('../services/dbService');

module.exports = (bot) => {
    // Helper function to show Main Menu
    const showMainMenu = async (ctx, isEdit = false) => {
        await config.loadDynamicSettings();
        const userId = ctx.from.id;
        const user = await dbService.getUser(userId) || { credits: 0 };
        const credits = user.credits || 0;
        const isAdmin = config.adminIds.includes(userId);

        const text = `👋 *Welcome to ${config.botName}*\n\n` +
                     `💰 *Your Balance:* \`${credits} Credits\`\n` +
                     `🆔 *User ID:* \`${userId}\`\n\n` +
                     `📢 *Updates:* ${config.forceJoin.channelId}`;

        const btns = [
            [{ text: '💎 Earn Credits', callback_data: 'earn_options' }, { text: '👤 Profile', callback_data: 'user_profile' }],
            [{ text: '📢 Join Updates', url: config.forceJoin.channelLink }]
        ];

        if (isAdmin) {
            btns.unshift([{ text: '🛠 Admin Dashboard', callback_data: 'admin_panel_start' }]);
        }

        if (isEdit) {
            return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } }).catch(() => {});
        } else {
            return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
        }
    };

    bot.start(async (ctx) => {
        const userId = ctx.from.id;
        const payload = ctx.payload;

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
            const user = await dbService.getUser(userId) || { credits: 0 };
            const isAdmin = config.adminIds.includes(userId);
            if (user.credits >= config.credits.costPerDownload || isAdmin) {
                const delivered = await deliveryService.deliverFile(ctx, payload, userId);
                if (delivered && !isAdmin) await dbService.deductCredit(userId);
            } else {
                return showUnlockPage(ctx, payload, user.credits);
            }
            return;
        }

        return showMainMenu(ctx);
    });

    const showUnlockPage = async (ctx, fileCode, credits) => {
        if (ctx.callbackQuery) ctx.answerCbQuery().catch(() => {});
        const text = `🔓 *Unlock Your File*\n\nYour Credits: \`${credits}\`\n\nChoose an option:`;
        const kb = [
            [{ text: '🔗 Option 1: Verification (+7)', callback_data: `sl_${fileCode}` }],
            [{ text: '📺 Option 2: Watch Ad (+3/5)', callback_data: `ad_${fileCode}` }],
            [{ text: '🔙 Back to Menu', callback_data: 'user_back' }]
        ];
        if (ctx.callbackQuery) await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        else await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    };

    bot.action('user_back', async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        return showMainMenu(ctx, true);
    });

    bot.action('user_profile', async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        const user = await dbService.getUser(ctx.from.id) || { credits: 0 };
        const text = `👤 *Your Profile*\n\n` +
                     `💰 *Balance:* \`${user.credits} Credits\`\n` +
                     `🆔 *ID:* \`${ctx.from.id}\`\n` +
                     `👑 *Status:* ${config.adminIds.includes(ctx.from.id) ? 'Admin' : 'User'}`;
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'user_back' }]] } });
    });

    bot.action('earn_options', async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        const user = await dbService.getUser(ctx.from.id) || { credits: 0 };
        const text = `💎 *Earn Credits Menu*\n\nBalance: \`${user.credits}\` Credits\n\nChoose a method:`;
        const kb = [
            [{ text: '🔗 Verification (+7)', callback_data: 'sl_direct' }],
            [{ text: '📺 Watch Ad (+5)', callback_data: 'ad_direct' }],
            [{ text: '🔙 Back', callback_data: 'user_back' }]
        ];
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    });

    bot.action(/^file_(.*)$/, async (ctx) => {
        const fileCode = ctx.match[1];
        const user = await dbService.getUser(ctx.from.id);
        if (user && user.credits >= config.credits.costPerDownload) {
            const delivered = await deliveryService.deliverFile(ctx, fileCode, ctx.from.id);
            if (delivered) {
                await dbService.deductCredit(ctx.from.id);
                await ctx.deleteMessage().catch(() => {});
            }
        } else {
            await ctx.answerCbQuery('❌ Credits not earned yet.', { show_alert: true });
        }
    });
};
