const config = require('../config/config');
const db = require('../services/db');
const creditService = require('../services/creditService');

module.exports = (bot) => {
    // Helper to check channel membership
    const checkMembership = async (ctx, userId) => {
        if (config.adminIds.includes(userId)) return true;
        if (!config.forceJoinChannel) return true;
        try {
            const member = await ctx.telegram.getChatMember(config.forceJoinChannel, userId);
            const allowed = ['member', 'administrator', 'creator'];
            return allowed.includes(member.status);
        } catch (e) {
            return true; // Bypass if bot is not admin or channel not found
        }
    };

    // Helper to send file by ID and Type (Zero storage consumption)
    const sendFile = async (ctx, file) => {
        const opts = { caption: file.caption || '', parse_mode: 'Markdown' };
        try {
            if (file.file_type === 'vid') await ctx.replyWithVideo(file.file_id, opts);
            else if (file.file_type === 'aud') await ctx.replyWithAudio(file.file_id, opts);
            else if (file.file_type === 'img') await ctx.replyWithPhoto(file.file_id, opts);
            else if (file.file_type === 'url') {
                const kb = [[{ text: '📥 Open Original Link', url: file.original_url }]];
                await ctx.reply(`🔗 *URL Link Ready*\n\nName: ${file.file_name}`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
            }
            else await ctx.replyWithDocument(file.file_id, opts);
            return true;
        } catch (e) {
            console.error("Delivery error:", e.message);
            return false;
        }
    };

    const deliverFileOrBatch = async (ctx, code, userId, settings, isAdmin) => {
        const file = await db.getFile(code);
        if (!file) return ctx.reply("❌ File not found!");

        let success = false;
        if (file.isBatch) {
            for (const f of file.files) await sendFile(ctx, f);
            success = true;
        } else {
            success = await sendFile(ctx, file);
        }

        if (success && !isAdmin) {
            await creditService.spendCredits(userId, settings.downloadCost);
            await db.recordDownload(userId, code);
        }
        return success;
    };

    const showDownloadPage = async (ctx, payload) => {
        const file = await db.getFile(payload);
        if (!file) return ctx.reply("❌ Invalid link.");

        const userId = ctx.from.id;
        const user = await db.getUser(userId) || { credits: 0 };
        const settings = await db.getGlobalSettings();
        const isAdmin = config.adminIds.includes(userId);

        let text = file.isBatch ? `📦 *Batch Ready*\n\n` : `📁 *File Ready*\n\n`;
        if (file.isBatch) {
            const totalSize = file.files.reduce((acc, f) => acc + (f.file_size || 0), 0);
            text += `📑 *Total Files:* \`${file.files.length}\`\n⚖️ *Total Size:* \`${(totalSize / (1024 * 1024)).toFixed(2)} MB\``;
        } else {
            text += `📛 *Name:* \`${file.file_name}\`\n⚖️ *Size:* \`${(file.file_size / (1024 * 1024)).toFixed(2)} MB\``;
        }
        text += `\n\n💰 *Your Credits:* \`${user.credits}\`\n📥 *Download Cost:* \`${settings.downloadCost} Credits\``;

        const kb = [[{ text: (user.credits >= settings.downloadCost || isAdmin) ? '⬇️ Download Now' : '💎 Earn Credits', callback_data: `dl_${payload}` }]];
        kb.push([{ text: '🔙 Back', callback_data: 'main' }]);

        return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    };

    bot.start(async (ctx) => {
        try {
            const payload = ctx.payload;
            const userId = ctx.from.id;
            if (!(await db.getUser(userId))) await db.createUser(userId, { name: ctx.from.first_name });

            // Handle Rewards from Shortlink/Ad
            if (payload && (payload.startsWith('reward_') || payload.startsWith('v_'))) {
                const parts = payload.split('_');
                const type = parts[0]; // 'reward' or 'v'
                const sessionId = parts[1];
                const fileCode = parts[2] || 'direct';

                if (type === 'v') {
                    const session = await db.getSession(sessionId);
                    if (session && !session.rewarded) {
                        const settings = await db.getGlobalSettings();
                        await creditService.addCredits(userId, settings.rewardVerification);
                        await db.updateSession(sessionId, { rewarded: true, status: true });
                        await ctx.reply(`✅ *Verification Success!*\n\nCredits added.`, { parse_mode: 'Markdown' });

                        // Auto-Download Check
                        const user = await db.getUser(userId);
                        const isAdmin = config.adminIds.includes(userId);
                        if (fileCode !== 'direct' && (user.credits >= settings.downloadCost || isAdmin)) {
                            return deliverFileOrBatch(ctx, fileCode, userId, settings, isAdmin);
                        }
                        if (fileCode !== 'direct') return showDownloadPage(ctx, fileCode);
                    }
                } else if (type === 'reward') {
                    try {
                        const result = await db.claimBloggerReward(sessionId, userId);
                        if (result.success) {
                            await ctx.reply(`✅ *Reward verified successfully.*\n\n🎉 Credits added.`, { parse_mode: 'Markdown' });

                            // Auto-Download Check
                            const user = await db.getUser(userId);
                            const settings = await db.getGlobalSettings();
                            const isAdmin = config.adminIds.includes(userId);
                            if (fileCode !== 'direct' && (user.credits >= settings.downloadCost || isAdmin)) {
                                return deliverFileOrBatch(ctx, fileCode, userId, settings, isAdmin);
                            }
                            if (fileCode !== 'direct') return showDownloadPage(ctx, fileCode);
                        }
                    } catch (e) {
                        if (['SESSION_NOT_FOUND', 'SESSION_EXPIRED', 'ALREADY_REWARDED'].includes(e.message)) {
                            await ctx.reply(`❌ Invalid or expired reward session.`);
                        } else {
                            console.error("Reward error:", e);
                            await ctx.reply(`❌ An error occurred while verifying reward.`);
                        }
                    }
                }
                return;
            }

            if (payload) {
                const isMember = await checkMembership(ctx, userId);
                if (!isMember) {
                    return ctx.reply(`🚫 You must join our channel before downloading.`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📢 Join Channel', url: config.forceJoinLink }],
                                [{ text: '✅ Check Again', callback_data: `verify_fj_${payload}` }]
                            ]
                        }
                    });
                }
                return showDownloadPage(ctx, payload);
            }

            // Show Main Menu
            const user = await db.getUser(userId) || { credits: 0 };
            const text = `👋 *Welcome to ${config.botUsername}*\n\n💰 *Balance:* \`${user.credits} Credits\``;
            const kb = [[{ text: '👤 My Profile', callback_data: 'profile' }]];
            if (config.adminIds.includes(userId)) kb.unshift([{ text: '🛠 Admin Panel', callback_data: 'admin' }]);
            return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        } catch (e) {
            console.error("Start command error:", e);
        }
    });

    bot.action(/^verify_fj_(.*)$/, async (ctx) => {
        try {
            const payload = ctx.match[1];
            const isMember = await checkMembership(ctx, ctx.from.id);

            if (!isMember) {
                return ctx.answerCbQuery("🚫 You still haven't joined!", { show_alert: true });
            }

            await ctx.answerCbQuery("✅ Thank you for joining!");
            await ctx.deleteMessage();

            return showDownloadPage(ctx, payload);
        } catch (e) {
            console.error("FJ verify error:", e);
        }
    });

    bot.action(/^dl_(.*)$/, async (ctx) => {
        try {
            const code = ctx.match[1];
            const userId = ctx.from.id;
            const isAdmin = config.adminIds.includes(userId);
            const settings = await db.getGlobalSettings();

            const user = await db.getUser(userId) || { credits: 0 };
            if (user.credits < settings.downloadCost && !isAdmin) {
                const text = `━━━━━━━━━━━━━━━━━━\n` +
                             `❌ *Insufficient Credits*\n\n` +
                             `You need credits to download files.\n\n` +
                             `*Earn Credits*\n\n` +
                             `🔗 *Verification Link*\n` +
                             `Reward:\n` +
                             `+2 Credits\n\n` +
                             `Complete the verification to earn credits.\n\n` +
                             `------------------------\n\n` +
                             `📺 *Watch Rewarded Ad*\n` +
                             `Reward:\n` +
                             `+3 Credits\n\n` +
                             `Watch the full rewarded ad.\n\n` +
                             `━━━━━━━━━━━━━━━━━━`;

                const kb = [
                    [{ text: '🔓 Start Verification', callback_data: `short_${code}` }],
                    [{ text: '📺 Watch Ad', callback_data: `watch_${code}` }],
                    [{ text: '🔙 Back', callback_data: 'main' }]
                ];

                return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
            }

            await ctx.answerCbQuery("✅ Delivering directly from Telegram...");
            await deliverFileOrBatch(ctx, code, userId, settings, isAdmin);
        } catch (e) {
            console.error("Download action error:", e);
            ctx.answerCbQuery("❌ Error processing download.");
        }
    });

    bot.action('main', async (ctx) => {
        try {
            const user = await db.getUser(ctx.from.id) || { credits: 0 };
            const text = `👋 *Welcome*\n\n💰 *Balance:* \`${user.credits} Credits\``;
            const kb = [[{ text: '👤 My Profile', callback_data: 'profile' }]];
            if (config.adminIds.includes(ctx.from.id)) kb.unshift([{ text: '🛠 Admin Panel', callback_data: 'admin' }]);
            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        } catch (e) {
            console.error("Main menu error:", e);
        }
    });

    bot.action('profile', async (ctx) => {
        try {
            const user = await db.getUser(ctx.from.id) || { credits: 0 };
            const text = `👤 *Your Profile*\n\n` +
                         `🆔 ID: \`${ctx.from.id}\`\n` +
                         `💰 Credits: \`${user.credits}\`\n` +
                         `📈 Total Earned: \`${user.totalEarned || 0}\`\n` +
                         `📉 Total Spent: \`${user.totalSpent || 0}\`\n` +
                         `✨ Status: \`${user.status || 'Active'}\``;

            const kb = [[{ text: '💎 Get VIP', callback_data: 'get_vip' }], [{ text: '🔙 Back', callback_data: 'main' }]];
            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        } catch (e) {
            console.error("Profile error:", e);
        }
    });
};
