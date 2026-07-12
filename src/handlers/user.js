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

    const deliverFileOrBatch = async (ctx, code, userId, settings, isAdmin, isVip) => {
        const file = await db.getFile(code);
        if (!file) return ctx.reply("❌ File not found!");

        let success = false;
        if (file.isBatch) {
            for (const f of file.files) await sendFile(ctx, f);
            success = true;
        } else {
            success = await sendFile(ctx, file);
        }

        if (success && !isAdmin && !isVip) {
            await creditService.spendCredits(userId, settings.downloadCost);
            await db.recordDownload(userId, code);
        } else if (success) {
            await db.recordDownload(userId, code);
        }
        return success;
    };

    const showDownloadPage = async (ctx, payload) => {
        const file = await db.getFile(payload);
        if (!file) return ctx.reply("❌ Invalid link.");

        const userId = ctx.from.id;
        const user = await db.getUser(userId) || { credits: 0, status: 'active' };
        const settings = await db.getGlobalSettings();
        const isAdmin = config.adminIds.includes(userId);
        const isVip = user.isVip === true || user.status === 'vip';

        let text = file.isBatch ? `📦 *Batch Ready*\n\n` : `📁 *File Ready*\n\n`;
        if (file.isBatch) {
            const totalSize = file.files.reduce((acc, f) => acc + (f.file_size || 0), 0);
            text += `📑 *Total Files:* \`${file.files.length}\`\n⚖️ *Total Size:* \`${(totalSize / (1024 * 1024)).toFixed(2)} MB\``;
        } else {
            text += `📛 *Name:* \`${file.file_name}\`\n⚖️ *Size:* \`${(file.file_size / (1024 * 1024)).toFixed(2)} MB\``;
        }

        if (!isVip && !isAdmin) {
            text += `\n\n💰 *Your Credits:* \`${user.credits}\`\n📥 *Download Cost:* \`${settings.downloadCost} Credits\``;
        } else if (isVip) {
            text += `\n\n✨ *VIP Status:* \`Active\` (Unlimited Access)`;
        }

        const kb = [[{ text: (user.credits >= settings.downloadCost || isAdmin || isVip) ? '⬇️ Download Now' : '💎 Earn Credits', callback_data: `dl_${payload}` }]];
        kb.push([{ text: '🔙 Back', callback_data: 'main' }]);

        return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    };

    bot.start(async (ctx) => {
        try {
            const payload = ctx.payload;
            const userId = ctx.from.id;

            let user = await db.getUser(userId);
            if (!user) {
                await db.createUser(userId, {
                    name: ctx.from.first_name,
                    credits: 3,
                    signupBonus: true
                });

                const welcomeText = `━━━━━━━━━━━━━━━━━━━━━━\n` +
                                   `🎉 *Welcome to Telegram File Portal*\n\n` +
                                   `🎁 *Welcome Gift*\n` +
                                   `You received\n` +
                                   `✨ *+3 FREE Credits*\n\n` +
                                   `You can immediately use these credits to download files.\n` +
                                   `━━━━━━━━━━━━━━━━━━━━━━\n` +
                                   `📥 *Download Cost*\n` +
                                   `• 1 Download = 1 Credit\n` +
                                   `━━━━━━━━━━━━━━━━━━━━━━\n` +
                                   `💰 *Need More Credits?*\n` +
                                   `📺 *Watch Rewarded Ad*\n` +
                                   `+3 Credits\n` +
                                   `*OR*\n` +
                                   `🔗 *Complete Verification*\n` +
                                   `+5 Credits\n\n` +
                                   `You can use ANY ONE option whenever your credits run out.\n` +
                                   `━━━━━━━━━━━━━━━━━━━━━━\n` +
                                   `Enjoy your experience ❤️`;

                const welcomeKb = [
                    [{ text: '📥 Start Downloading', callback_data: 'main' }],
                    [{ text: '💰 Earn More Credits', callback_data: 'earn_credits' }]
                ];

                await ctx.reply(welcomeText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: welcomeKb } });
                user = await db.getUser(userId);
            }

            // Handle Rewards from Shortlink/Ad
            if (payload && (payload.startsWith('reward_') || payload.startsWith('v_'))) {
                const parts = payload.split('_');
                const type = parts[0]; // 'reward' or 'v'
                const sessionId = parts[1];
                const fileCode = parts[2] || 'direct';

                if (type === 'v') {
                    try {
                        const result = await db.claimShortlinkReward(sessionId, userId);
                        if (result.success) {
                            const text = `✅ *Verification Completed*\n\n` +
                                         `🎉 *+${result.amount} Credits Added*\n\n` +
                                         `Your balance has been updated successfully.`;
                            const kb = [];
                            if (fileCode !== 'direct') {
                                kb.push([{ text: '📥 Continue Download', callback_data: `dl_${fileCode}` }]);
                            } else {
                                kb.push([{ text: '🔙 Back to Menu', callback_data: 'main' }]);
                            }
                            return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
                        }
                    } catch (e) {
                        if (['SESSION_NOT_FOUND', 'SESSION_EXPIRED', 'ALREADY_REWARDED'].includes(e.message)) {
                            await ctx.reply(`❌ Invalid or expired reward session.`);
                        } else {
                            console.error("Shortlink reward error:", e);
                            await ctx.reply(`❌ An error occurred while verifying reward.`);
                        }
                    }
                } else if (type === 'reward') {
                    try {
                        const result = await db.claimBloggerReward(sessionId, userId);
                        if (result.success) {
                            const text = `✅ *Rewarded Ad Completed*\n\n` +
                                         `🎉 *+${result.amount} Credits Added*\n\n` +
                                         `Your balance has been updated successfully.`;
                            const kb = [];
                            if (fileCode !== 'direct') {
                                kb.push([{ text: '📥 Continue Download', callback_data: `dl_${fileCode}` }]);
                            } else {
                                kb.push([{ text: '🔙 Back to Menu', callback_data: 'main' }]);
                            }
                            return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
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
            const currentUser = await db.getUser(userId) || { credits: 0 };
            const text = `👋 *Welcome to ${config.botUsername}*\n\n💰 *Balance:* \`${currentUser.credits} Credits\``;
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

            const user = await db.getUser(userId) || { credits: 0, status: 'active' };
            const isVip = user.isVip === true || user.status === 'vip';

            if (user.credits < settings.downloadCost && !isAdmin && !isVip) {
                const text = `💰 *Earn Download Credits*\n\n` +
                             `Choose ANY ONE method below.\n\n` +
                             `These are two separate methods.\n` +
                             `You *DO NOT* need to complete both.\n\n` +
                             `━━━━━━━━━━━━━━━━━━━━\n\n` +
                             `⭐ *FASTEST METHOD*\n` +
                             `📺 *Watch Rewarded Ad*\n\n` +
                             `⏱ About 15 seconds\n` +
                             `🎁 *Reward:* +3 Credits\n\n` +
                             `Watch one rewarded advertisement completely.\n` +
                             `Credits will be added automatically after the ad finishes.\n\n` +
                             `[ 📺 Earn 3 Credits ]\n` +
                             `🟢 *Instant Credit*\n\n` +
                             `━━━━━━━━━━━━━━━━━━━━\n\n` +
                             `──────── OR ────────\n\n` +
                             `━━━━━━━━━━━━━━━━━━━━\n\n` +
                             `🔗 *Complete Linkvertise Verification*\n\n` +
                             `⏱ About 20–40 seconds\n` +
                             `🎁 *Reward:* +5 Credits\n\n` +
                             `Complete ONE Linkvertise verification.\n` +
                             `Credits will be added automatically after successful completion.\n\n` +
                             `[ 🔗 Earn 5 Credits ]\n` +
                             `🔵 *Verification Required*\n\n` +
                             `━━━━━━━━━━━━━━━━━━━━\n\n` +
                             `*Notice:* You only need to complete ONE option.\n` +
                             `Both methods give download credits.`;

                const kb = [
                    [{ text: '📺 Earn 3 Credits', callback_data: `watch_${code}` }],
                    [{ text: '🔗 Earn 5 Credits', callback_data: `short_${code}` }],
                    [{ text: '🔙 Back', callback_data: 'main' }]
                ];

                return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
            }

            await ctx.answerCbQuery("✅ Delivering directly from Telegram...");
            await deliverFileOrBatch(ctx, code, userId, settings, isAdmin, isVip);
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

    bot.action('earn_credits', async (ctx) => {
        try {
            const settings = await db.getGlobalSettings();
            const text = `💰 *Earn Download Credits*\n\n` +
                         `Choose ANY ONE method below.\n\n` +
                         `These are two separate methods.\n` +
                         `You *DO NOT* need to complete both.\n\n` +
                         `━━━━━━━━━━━━━━━━━━━━\n\n` +
                         `⭐ *FASTEST METHOD*\n` +
                         `📺 *Watch Rewarded Ad*\n\n` +
                         `⏱ About 15 seconds\n` +
                         `🎁 *Reward:* +3 Credits\n\n` +
                         `Watch one rewarded advertisement completely.\n` +
                         `Credits will be added automatically after the ad finishes.\n\n` +
                         `[ 📺 Earn 3 Credits ]\n` +
                         `🟢 *Instant Credit*\n\n` +
                         `━━━━━━━━━━━━━━━━━━━━\n\n` +
                         `──────── OR ────────\n\n` +
                         `━━━━━━━━━━━━━━━━━━━━\n\n` +
                         `🔗 *Complete Linkvertise Verification*\n\n` +
                         `⏱ About 20–40 seconds\n` +
                         `🎁 *Reward:* +5 Credits\n\n` +
                         `Complete ONE Linkvertise verification.\n` +
                         `Credits will be added automatically after successful completion.\n\n` +
                         `[ 🔗 Earn 5 Credits ]\n` +
                         `🔵 *Verification Required*\n\n` +
                         `━━━━━━━━━━━━━━━━━━━━\n\n` +
                         `*Notice:* You only need to complete ONE option.\n` +
                         `Both methods give download credits.`;

            const kb = [
                [{ text: '📺 Earn 3 Credits', callback_data: `watch_direct` }],
                [{ text: '🔗 Earn 5 Credits', callback_data: `short_direct` }],
                [{ text: '🔙 Back', callback_data: 'main' }]
            ];

            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        } catch (e) {
            console.error("Earn credits error:", e);
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
