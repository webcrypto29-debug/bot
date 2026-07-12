const config = require('../config/config');
const db = require('../services/db');
const crypto = require('crypto');

const adminStates = new Map();

module.exports = (bot) => {
    // Middleware to check Admin
    const adminCheck = (ctx, next) => {
        if (config.adminIds.includes(ctx.from.id)) return next();
        return ctx.reply("❌ Access Denied: Admins Only.");
    };

    // Helper to generate unique code
    const generateCode = (prefix = '') => {
        return prefix + crypto.randomBytes(4).toString('hex').toUpperCase();
    };

    // Helper to extract file data from message
    const getFileData = (msg) => {
        const file = msg.document || msg.video || msg.audio || (msg.photo ? msg.photo[msg.photo.length - 1] : null);
        if (!file) return null;

        return {
            file_id: file.file_id,
            file_name: file.file_name || msg.caption || 'Unnamed File',
            file_size: file.file_size || 0,
            file_type: msg.document ? 'doc' : (msg.video ? 'vid' : (msg.audio ? 'aud' : (msg.photo ? 'img' : 'doc'))),
            upload_time: new Date(),
            messageId: msg.message_id,
            caption: msg.caption || ''
        };
    };

    // Helper to parse Telegram Message Links
    const parseTelegramLink = (url) => {
        const publicMatch = url.match(/https?:\/\/t\.me\/([a-zA-Z0-9_]+)\/(\d+)/);
        if (publicMatch) return { chatId: publicMatch[1].startsWith('@') ? publicMatch[1] : `@${publicMatch[1]}`, messageId: parseInt(publicMatch[2]) };

        const privateMatch = url.match(/https?:\/\/t\.me\/c\/(\d+)\/(\d+)/);
        if (privateMatch) return { chatId: `-100${privateMatch[1]}`, messageId: parseInt(privateMatch[2]) };

        return null;
    };

    // Main Admin Dashboard
    const showAdminPanel = async (ctx, isEdit = false) => {
        const text = `🛠 *Admin Dashboard*\n\nWelcome Master, choose an action:`;
        const kb = [
            [{ text: '📁 Generate Link', callback_data: 'admin_gen_link' }, { text: '📦 Generate Batch', callback_data: 'admin_gen_batch' }],
            [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
            [{ text: '📊 Statistics', callback_data: 'admin_stats' }, { text: '⚙️ Settings', callback_data: 'admin_settings' }],
            [{ text: '💳 Pending Payments', callback_data: 'admin_payments' }],
            [{ text: '🔙 Back to User Menu', callback_data: 'main' }]
        ];

        if (isEdit) return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(() => {});
        return ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
    };

    bot.action('admin', adminCheck, (ctx) => showAdminPanel(ctx, true));

    // --- Statistics ---
    bot.action('admin_stats', adminCheck, async (ctx) => {
        const stats = await db.getAdminStats();
        const text = `📊 *Bot Statistics*\n\n` +
                     `👥 Total Users: \`${stats.totalUsers}\`\n` +
                     `📁 Total Files: \`${stats.totalFiles}\`\n` +
                     `📥 Total Downloads: \`${stats.totalDownloads}\`\n` +
                     `🔗 Generated Links: \`${stats.generatedLinks}\``;

        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin' }]] } });
    });

    bot.action('admin_settings', adminCheck, async (ctx) => {
        try {
            const settings = await db.getGlobalSettings();
            const text = `⚙️ *Bot Settings*\n\n` +
                         `🔗 Verify Reward: \`${settings.rewardVerification} Credits\`\n` +
                         `📺 Ad Reward: \`${settings.rewardAd} Credits\`\n` +
                         `📥 Download Cost: \`${settings.downloadCost} Credits\`\n\n` +
                         `*Click a button below to edit:*`;

            const kb = [
                [{ text: '✏️ Edit Verify Reward', callback_data: 'set_reward_verify' }],
                [{ text: '✏️ Edit Ad Reward', callback_data: 'set_reward_ad' }],
                [{ text: '✏️ Edit Download Cost', callback_data: 'set_download_cost' }],
                [{ text: '🔙 Back', callback_data: 'admin' }]
            ];

            await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        } catch (e) {
            console.error("Settings menu error:", e);
        }
    });

    bot.action('admin_payments', adminCheck, async (ctx) => {
        try {
            const payments = await db.getPendingPayments();
            if (payments.length === 0) {
                return ctx.editMessageText("✅ No pending payments.", { reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin' }]] } });
            }

            const p = payments[0]; // Process one by one for simplicity
            const text = `💳 *Pending Payment*\n\n` +
                         `👤 User: ${p.userName} (\`${p.userId}\`)\n` +
                         `💎 Plan: ${p.plan}\n` +
                         `💵 Amount: ₹${p.amount}\n` +
                         `🆔 Trans ID: \`${p.transactionId}\`\n` +
                         `📅 Date: ${p.createdAt.toDate ? p.createdAt.toDate().toLocaleString() : new Date(p.createdAt).toLocaleString()}`;

            const kb = [
                [{ text: '✅ Approve', callback_data: `approve_pay_${p.id}` }, { text: '❌ Decline', callback_data: `decline_pay_${p.id}` }],
                [{ text: '🔙 Back', callback_data: 'admin' }]
            ];
            await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        } catch (e) {
            console.error("Admin payments error:", e);
        }
    });

    bot.action(/^approve_pay_(.*)$/, adminCheck, async (ctx) => {
        try {
            const payId = ctx.match[1];
            const p = await db.getPayment(payId);
            if (!p) return ctx.answerCbQuery("❌ Payment not found.");

            await db.approvePayment(payId);

            // Add Credits based on Plan
            const creditsToAdd = p.plan === 'Monthly' ? config.vip.monthlyCredits : config.vip.yearlyCredits;
            await db.updateCredits(p.userId, creditsToAdd);

            // Notification to user
            bot.telegram.sendMessage(p.userId, `🎉 *Payment Approved!*\n\nYour account has been credited with *${creditsToAdd} Credits*. Enjoy!`, { parse_mode: 'HTML' }).catch(() => {});

            ctx.answerCbQuery(`✅ Payment Approved! ${creditsToAdd} Credits added.`);
            return showAdminPanel(ctx, true);
        } catch (e) {
            console.error("Approve payment error:", e);
            ctx.answerCbQuery("❌ Error approving payment.");
        }
    });

    bot.action(/^decline_pay_(.*)$/, adminCheck, async (ctx) => {
        try {
            const payId = ctx.match[1];
            await db.updatePayment(payId, { status: 'declined', declinedAt: new Date() });
            ctx.answerCbQuery("❌ Payment Declined.");
            return showAdminPanel(ctx, true);
        } catch (e) {
            console.error("Decline payment error:", e);
        }
    });

    // Setting update handlers
    bot.action('set_reward_verify', adminCheck, (ctx) => {
        adminStates.set(ctx.from.id, { step: 'SET_REWARD_VERIFY' });
        ctx.reply("📝 Send the new value for *Verification Reward*:");
    });
    bot.action('set_reward_ad', adminCheck, (ctx) => {
        adminStates.set(ctx.from.id, { step: 'SET_REWARD_AD' });
        ctx.reply("📝 Send the new value for *Rewarded Ad Reward*:");
    });
    bot.action('set_download_cost', adminCheck, (ctx) => {
        adminStates.set(ctx.from.id, { step: 'SET_DOWNLOAD_COST' });
        ctx.reply("📝 Send the new value for *Download Cost*:");
    });

    // --- Generate Single Link ---
    bot.action('admin_gen_link', adminCheck, async (ctx) => {
        adminStates.set(ctx.from.id, { step: 'AWAITING_FILE' });
        await ctx.editMessageText('📑 *Generate Link*\n\nForward **one file** from your storage channel now.', {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin' }]] }
        });
    });

    // --- Generate Batch Link ---
    bot.action('admin_gen_batch', adminCheck, async (ctx) => {
        adminStates.set(ctx.from.id, { step: 'AWAITING_BATCH', files: [] });
        await ctx.editMessageText('📦 *Generate Batch*\n\nForward multiple files from storage.\n\nWhen finished, send `/done`.', {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin' }]] }
        });
    });

    // --- Broadcast ---
    bot.action('admin_broadcast', adminCheck, async (ctx) => {
        adminStates.set(ctx.from.id, { step: 'AWAITING_BROADCAST' });
        await ctx.editMessageText('📢 *Broadcast System*\n\nSend the message you want to broadcast to all users.', {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin' }]] }
        });
    });

    // --- Handler for Messages (Awaiting States) ---
    bot.on(['message', 'document', 'video', 'audio', 'photo'], async (ctx, next) => {
        const userId = ctx.from.id;
        const state = adminStates.get(userId);

        // If no state, let other handlers process it (important for users sending Transaction IDs)
        if (!state) return next();

        // Security: Ensure only admins can trigger active admin states
        if (!config.adminIds.includes(userId)) {
            adminStates.delete(userId);
            return next();
        }

        const msg = ctx.message;

        // Settings updates
        if (msg.text && state.step.startsWith('SET_')) {
            const val = parseInt(msg.text);
            if (isNaN(val)) return ctx.reply("❌ Invalid number. Please send a numeric value.");

            if (state.step === 'SET_REWARD_VERIFY') await db.updateGlobalSettings({ rewardVerification: val });
            if (state.step === 'SET_REWARD_AD') await db.updateGlobalSettings({ rewardAd: val });
            if (state.step === 'SET_DOWNLOAD_COST') await db.updateGlobalSettings({ downloadCost: val });

            adminStates.delete(userId);
            return ctx.reply("✅ Setting updated successfully!");
        }

        // 1. Broadcast Logic
        if (state.step === 'AWAITING_BROADCAST') {
            const users = await db.getAllUsers();
            let success = 0, failed = 0;

            const statusMsg = await ctx.reply(`🚀 Broadcasting to ${users.length} users...`);

            for (const targetId of users) {
                try {
                    await ctx.copyMessage(targetId);
                    success++;
                } catch (e) { failed++; }
            }

            adminStates.delete(userId);
            return ctx.reply(`📢 *Broadcast Finished*\n\n✅ Success: \`${success}\`\n❌ Failed: \`${failed}\`\n👥 Total: \`${users.length}\``, { parse_mode: 'HTML' });
        }

        // 2. Batch Logic /done
        if (msg.text === '/done' && state.step === 'AWAITING_BATCH') {
            try {
                if (!state.files || state.files.length === 0) return ctx.reply("❌ Batch is empty.");
                const code = generateCode('BATCH_');
                await db.saveBatch(code, state.files, userId);
                adminStates.delete(userId);
                return ctx.reply(`✅ *Batch Link Generated*\n\n🔗 https://t.me/${config.botUsername}?start=${code}`, { parse_mode: 'HTML' });
            } catch (e) {
                console.error("Batch Gen Error:", e);
                return ctx.reply("❌ Error generating batch link.");
            }
        }

        let fileData = getFileData(msg);

        // 3. Telegram Link Processing
        if (!fileData && msg.text && (state.step === 'AWAITING_FILE' || state.step === 'AWAITING_BATCH')) {
            const linkData = parseTelegramLink(msg.text);
            if (linkData) {
                try {
                    // Use forwardMessage to get the actual message object with file data
                    const tempMsg = await ctx.telegram.forwardMessage(ctx.from.id, linkData.chatId, linkData.messageId);
                    fileData = getFileData(tempMsg);
                    await ctx.telegram.deleteMessage(ctx.from.id, tempMsg.message_id);
                } catch (e) {
                    // Fail gracefully, will check generic URL logic below
                }
            }

            // 4. Generic URL Processing
            if (!fileData && msg.text.startsWith('http')) {
                fileData = {
                    file_name: msg.text.split('/').pop() || 'URL Link',
                    file_type: 'url',
                    original_url: msg.text,
                    upload_time: new Date(),
                    file_size: 0
                };
            }
        }

        if (!fileData) return;

        if (state.step === 'AWAITING_FILE') {
            const code = generateCode();
            await db.saveFile(code, fileData);
            adminStates.delete(userId);
            return ctx.reply(`✅ Link Generated Successfully\n\n🔗 https://t.me/${config.botUsername}?start=${code}`, { parse_mode: 'HTML' });
        }

        if (state.step === 'AWAITING_BATCH') {
            state.files.push(fileData);
            return ctx.reply(`➕ Added to batch (${state.files.length} total). Send more or /done.`);
        }
    });
};
