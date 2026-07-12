const db = require('../services/db');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * VIP Payment & Verification System for Erica File Bot.
 */
module.exports = (bot) => {
    // Global state to track users who are about to submit payment ID
    // We'll use a slightly different name to avoid conflicts
    const userPaymentProcess = new Map();

    // Show VIP Tiers
    bot.action('get_vip', async (ctx) => {
        try {
            await ctx.editMessageText(`💎 *Choose your VIP Plan*\n\n✅ Direct link access\n✅ Priority support\n✅ Access to all files\n\n🎁 *Monthly:* ₹${config.vip.monthly} (${config.vip.monthlyCredits} Credits)\n✨ *Yearly:* ₹${config.vip.yearly} (${config.vip.yearlyCredits} Credits)`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `Monthly - ₹${config.vip.monthly} (${config.vip.monthlyCredits} Credits)`, callback_data: 'pay_monthly' }],
                        [{ text: `Yearly - ₹${config.vip.yearly} (${config.vip.yearlyCredits} Credits)`, callback_data: 'pay_yearly' }],
                        [{ text: '🔙 Back', callback_data: 'user_back' }]
                    ]
                }
            });
        } catch (error) {
            logger.error('Error showing VIP tiers:', error);
        }
    });

    bot.action(['pay_monthly', 'pay_yearly'], async (ctx) => {
        try {
            const plan = ctx.match[0] === 'pay_monthly' ? 'Monthly' : 'Yearly';
            const price = plan === 'Monthly' ? config.vip.monthly : config.vip.yearly;

            await ctx.editMessageText(`💳 *Select Payment Method for ${plan} VIP*\n\nAmount to pay: ₹${price}`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📱 UPI (GPay/PhonePe/Paytm)', callback_data: `method_upi_${plan}` }],
                        [{ text: '🌐 PayPal', callback_data: `method_paypal_${plan}` }],
                        [{ text: '🔙 Back', callback_data: 'get_vip' }]
                    ]
                }
            });
        } catch (error) {
            logger.error('Error selecting payment method:', error);
        }
    });

    bot.action(/^method_(upi|paypal)_(Monthly|Yearly)$/, async (ctx) => {
        try {
            const method = ctx.match[1].toUpperCase();
            const plan = ctx.match[2];
            const price = plan === 'Monthly' ? config.vip.monthly : config.vip.yearly;
            const details = method === 'UPI' ? config.payment.upiId : config.payment.paypalEmail;

            let text = `✨ *${method} Payment - ${plan} VIP*\n\n`;
            text += `💰 Amount: *₹${price}*\n`;
            text += `👉 Send to: \`${details}\`\n\n`;
            text += `📝 *Instructions:*\n`;
            text += `1. Complete the payment.\n`;
            text += `2. Copy the Transaction ID / UTR number.\n`;
            text += `3. Click the button below to submit your ID.`;

            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ I have Paid - Submit ID', callback_data: `submit_pay_${method}_${plan}` }],
                        [{ text: '🔙 Back', callback_data: `pay_${plan.toLowerCase()}` }]
                    ]
                }
            });
        } catch (error) {
            logger.error('Error showing payment instructions:', error);
        }
    });

    bot.action(/^submit_pay_(UPI|PAYPAL)_(Monthly|Yearly)$/, async (ctx) => {
        try {
            const method = ctx.match[1];
            const plan = ctx.match[2];

            userPaymentProcess.set(ctx.from.id, { method, plan });

            await ctx.reply(`Please send your *${method} Transaction ID / UTR Number* now:\n\n_(Type /cancel to stop)_`, {
                parse_mode: 'Markdown'
            });
            await ctx.answerCbQuery();
        } catch (error) {
            logger.error('Error initiating payment submission:', error);
        }
    });

    // Handle Text Input for Transaction IDs
    bot.on('text', async (ctx, next) => {
        const state = userPaymentProcess.get(ctx.from.id);
        if (!state) return next(); // Not in payment process, let other handlers handle it

        const transactionId = ctx.message.text.trim();

        if (transactionId.toLowerCase() === '/cancel') {
            userPaymentProcess.delete(ctx.from.id);
            return ctx.reply('❌ Payment submission cancelled.');
        }

        try {
            // Duplicate Check
            const existing = await db.getPaymentByTransactionId(transactionId);
            if (existing) {
                return ctx.reply('⚠️ This Transaction ID has already been used. Contact support if this is an error.');
            }

            const payId = `${state.method}_${Date.now()}`;
            const amount = state.plan === 'Monthly' ? config.vip.monthly : config.vip.yearly;

            // Save to DB
            await db.savePayment(payId, {
                userId: ctx.from.id,
                userName: ctx.from.first_name,
                plan: state.plan,
                method: state.method,
                amount: amount,
                transactionId: transactionId,
                status: 'pending',
                createdAt: new Date()
            });

            // Notify Admin (As per Requirements)
            const adminMsg = `💎 *New VIP Payment Request*\n\n` +
                             `👤 *User:* ${ctx.from.first_name}\n` +
                             `📧 *Username:* @${ctx.from.username || 'N/A'}\n` +
                             `🆔 *ID:* \`${ctx.from.id}\`\n` +
                             `📝 *Transaction ID:* \`${transactionId}\`\n` +
                             `📅 *Time:* ${new Date().toLocaleString()}`;

            config.adminIds.forEach(adminId => {
                bot.telegram.sendMessage(adminId, adminMsg, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🛠 Verify in Admin Panel', callback_data: 'admin_payments' }]]
                    }
                }).catch(e => logger.error(`Admin notify failed for ${adminId}:`, e));
            });

            userPaymentProcess.delete(ctx.from.id);

            await ctx.reply(`✅ *Transaction submitted successfully.*\nAdmin will verify it soon.`, {
                parse_mode: 'Markdown'
            });

        } catch (error) {
            logger.error('Payment Text Handler Error:', error);
            await ctx.reply('❌ Error saving transaction. Please try again or contact Admin.');
        }
    });
};
