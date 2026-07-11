const config = require('../config/config');
const db = require('../services/db');
const creditService = require('../services/creditService');

module.exports = (bot) => {
    const showMenu = async (ctx, isEdit = false) => {
        const userId = ctx.from.id;
        const user = await db.getUser(userId) || { credits: 0 };
        const isAdmin = config.adminIds.includes(userId);

        const text = `👋 *Welcome to ${config.botUsername}*\n\n` +
                     `💰 *Balance:* \`${user.credits} Credits\`\n` +
                     `🆔 *ID:* \`${userId}\``;

        const kb = [[{ text: '👤 My Profile', callback_data: 'profile' }]];
        if (isAdmin) kb.unshift([{ text: '🛠 Admin Dashboard', callback_data: 'admin' }]);

        if (isEdit) return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } }).catch(() => {});
        return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
    };

    bot.start(async (ctx) => {
        const payload = ctx.payload;
        const userId = ctx.from.id;

        // Register user if not exists
        if (!(await db.getUser(userId))) {
            await db.createUser(userId, { name: ctx.from.first_name });
        }

        // --- Handle Rewarded Ad Success ---
        if (payload && payload.startsWith('reward_')) {
            const parts = payload.split('_');
            const sessionId = parts[1];
            const fileCode = parts[2];

            try {
                const session = await db.getAdSession(sessionId);
                if (!session) return ctx.reply("❌ Reward session invalid.");
                if (session.rewarded) return ctx.reply("✅ Credits already added!");

                // Expiry Check
                const now = new Date();
                const expires = session.expiresAt.toDate ? session.expiresAt.toDate() : new Date(session.expiresAt);
                if (now > expires) return ctx.reply("❌ Session expired. Please watch ad again.");

                const settings = await db.getGlobalSettings();
                await creditService.addCredits(userId, settings.rewardAd);
                await db.completeAdSession(sessionId);

                await ctx.reply(`✅ *Reward completed.*\n🎉 You earned ${settings.rewardAd} Credits.`, { parse_mode: 'Markdown' });

                // Redirect back to File Page
                if (fileCode === 'direct') {
                    return showMenu(ctx);
                } else {
                    return bot.handleUpdate({ message: { text: `/start ${fileCode}`, from: ctx.from, chat: ctx.chat, date: Date.now()/1000 }, update_id: 0 });
                }
            } catch (e) { console.error(e); }
            return;
        }

        // --- Handle Verification Success ---
        if (payload && payload.startsWith('v_')) {
            const sessionId = payload.split('_')[1];
            const session = await db.getSession(sessionId);
            if (session && session.userId === userId.toString()) {
                await db.collection('sessions').doc(sessionId).update({ status: true });
                return ctx.reply("✅ *Verification step completed!*\nNow go back to the previous message and click 'Verify Status'.", { parse_mode: 'Markdown' });
            }
        }

        // --- Handle File Links ---
        if (payload) {
            const file = await db.getFile(payload);
            if (!file) return ctx.reply("❌ Invalid or expired link.");

            const user = await db.getUser(userId) || { credits: 0 };
            const isAdmin = config.adminIds.includes(userId);
            const settings = await db.getGlobalSettings();

            const date = file.createdAt.toDate ? file.createdAt.toDate().toLocaleDateString() : new Date(file.createdAt).toLocaleDateString();
            const size = (file.file_size / (1024 * 1024)).toFixed(2);

            let text = `📁 *File Ready*\n\n` +
                       `📛 *Name:* \`${file.file_name}\`\n` +
                       `⚖️ *Size:* \`${size} MB\`\n` +
                       `📅 *Date:* \`${date}\`\n\n` +
                       `💰 *Your Credits:* \`${user.credits}\`\n` +
                       `📥 *Download Cost:* \`${settings.downloadCost} Credits\``;

            const kb = [];
            if (user.credits >= settings.downloadCost || isAdmin) {
                kb.push([{ text: '⬇️ Download File', callback_data: `dl_${payload}` }]);
            } else {
                text += `\n\n⚠️ *Insufficient Credits! Earn more:*`;
                kb.push([{ text: `🔗 Verification (+${settings.rewardVerification})`, callback_data: `short_${payload}` }]);
                kb.push([{ text: `📺 Watch Ad (+${settings.rewardAd})`, callback_data: `watch_${payload}` }]);
            }
            kb.push([{ text: '🔙 Back', callback_data: 'main' }]);

            return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        }

        return showMenu(ctx);
    });

    // Handle Download Action
    bot.action(/^dl_(.*)$/, async (ctx) => {
        const code = ctx.match[1];
        const userId = ctx.from.id;
        const isAdmin = config.adminIds.includes(userId);

        try {
            const settings = await db.getGlobalSettings();
            const hasCredits = await creditService.hasEnoughCredits(userId, settings.downloadCost);

            if (!hasCredits && !isAdmin) return ctx.answerCbQuery("❌ Insufficient Credits!", { show_alert: true });

            const file = await db.getFile(code);
            if (!file) return ctx.answerCbQuery("❌ File not found!");

            if (!isAdmin) await creditService.spendCredits(userId, settings.downloadCost);
            await db.recordDownload(userId, code);

            await ctx.answerCbQuery("✅ Preparing file...");
            if (file.isBatch) {
                for (const f of file.files) await ctx.replyWithDocument(f.file_id, { caption: f.caption }).catch(() => {});
            } else {
                await ctx.replyWithDocument(file.file_id, { caption: file.caption }).catch(() => {});
            }
        } catch (e) { ctx.answerCbQuery("❌ Download Failed."); }
    });

    bot.action('profile', async (ctx) => {
        const user = await db.getUser(ctx.from.id);
        const text = `👤 *Your Profile*\n\n💰 *Balance:* \`${user.credits || 0}\`\n📈 *Earned:* \`${user.totalEarned || 0}\`\n📉 *Spent:* \`${user.totalSpent || 0}\``;
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'main' }]] } });
    });

    bot.action('main', (ctx) => showMenu(ctx, true));
};
