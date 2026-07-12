const config = require('../config/config');
const db = require('../services/db');
const creditService = require('../services/creditService');
const axios = require('axios');
const crypto = require('crypto');

module.exports = (bot) => {
    // When user clicks "Verification" button from Unlock Page
    bot.action(/^short_(.*)$/, async (ctx) => {
        try {
            const fileCode = ctx.match[1];
            const userId = ctx.from.id;
            const isAdmin = config.adminIds.includes(userId);

            const user = await db.getUser(userId) || {};
            const lastClaim = user.lastVerificationClaim ? (user.lastVerificationClaim.toDate ? user.lastVerificationClaim.toDate() : new Date(user.lastVerificationClaim)) : new Date(0);
            const now = new Date();
            const diff = Math.floor((60000 - (now - lastClaim)) / 1000);

            if (diff > 0 && !isAdmin) {
                return ctx.answerCbQuery(`⏳ Please wait ${diff} seconds before earning credits again.`, { show_alert: true });
            }

            // 1. Generate unique session ID
            const sessionId = crypto.randomBytes(8).toString('hex').toUpperCase();

            // 2. Create session in DB
            await db.createVerificationSession(sessionId, userId);

            // 3. Construct the Blogger Linkvertise Gateway URL
            // Passing session, userId, fileCode, and botUsername
            const verifyUrl = `https://monetagad5367.blogspot.com/p/reward.html?session=${sessionId}&userId=${userId}&file=${fileCode}&bot=${config.botUsername}&type=verify`;

            const text = `🔗 *Linkvertise Verification*\n\n` +
                         `Complete this verification successfully to earn credits.\n` +
                         `Credits are awarded only after successful completion.\n\n` +
                         `⚠️ *Note:* Don't close the browser until you return to the bot.`;

            const kb = [
                [{ text: '🔓 Open Verification', url: verifyUrl }],
                [{ text: '✅ Verify Status', callback_data: `verify_${sessionId}_${fileCode}` }],
                [{ text: '🔙 Cancel', callback_data: 'main' }]
            ];

            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
            await ctx.answerCbQuery();

        } catch (e) {
            console.error("Verification initiation error:", e);
            ctx.answerCbQuery("❌ Error generating link. Try again.", { show_alert: true });
        }
    });

    // When user clicks "✅ Verify Status" button
    bot.action(/^verify_(.*)_(.*)$/, async (ctx) => {
        const sessionId = ctx.match[1];
        const fileCode = ctx.match[2];
        const userId = ctx.from.id;

        try {
            const session = await db.getSession(sessionId);

            if (!session) return ctx.answerCbQuery("❌ Session not found.", { show_alert: true });

            // Check expiry
            const now = new Date();
            const expires = session.expiresAt.toDate ? session.expiresAt.toDate() : new Date(session.expiresAt);
            if (now > expires) return ctx.answerCbQuery("❌ Verification session expired. Please restart.", { show_alert: true });

            if (session.status === true) {
                // Check if already rewarded (prevent duplicate rewards)
                if (session.rewarded) return ctx.answerCbQuery("✅ Credits already added!");

                const settings = await db.getGlobalSettings();
                await creditService.addCredits(userId, settings.rewardVerification);

                // Mark as rewarded
                await db.updateSession(sessionId, { rewarded: true });

                await ctx.reply(`✅ *Verification successful.*\n🎉 Credits added successfully.`, { parse_mode: 'Markdown' });

                // Redirect back to Download page
                // If it's a direct earn (no file code), go to main menu
                if (fileCode === 'direct') {
                    return bot.handleUpdate({ message: { text: '/start', from: ctx.from, chat: ctx.chat, date: Date.now()/1000 }, update_id: 0 });
                } else {
                    return bot.handleUpdate({ message: { text: `/start ${fileCode}`, from: ctx.from, chat: ctx.chat, date: Date.now()/1000 }, update_id: 0 });
                }
            } else {
                await ctx.answerCbQuery("❌ Verification not completed.\nPlease complete the verification first.", { show_alert: true });
            }
        } catch (e) {
            console.error(e);
            ctx.answerCbQuery("❌ Verification failed.");
        }
    });
};
