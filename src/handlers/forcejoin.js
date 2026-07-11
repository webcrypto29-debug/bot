const config = require('../config/config');
const logger = require('../utils/logger');
const deliveryService = require('../services/deliveryService');

/**
 * Clean Force Join verification handler.
 */
module.exports = (bot) => {
    bot.action(/^verify_fj_(.*)$/, async (ctx) => {
        const code = ctx.match[1];
        const userId = ctx.from.id;

        try {
            // 1. Verify membership
            const member = await ctx.telegram.getChatMember(config.forceJoin.channelId, userId);
            const allowed = ['member', 'administrator', 'creator'];

            if (!allowed.includes(member.status)) {
                return ctx.answerCbQuery('❌ You haven\'t joined the channel yet!', { show_alert: true });
            }

            await ctx.answerCbQuery('✅ Verification successful!');
            await ctx.deleteMessage(); // Remove the "Join Channel" prompt

            // 2. Resume Delivery Flow
            await deliveryService.deliverFile(ctx, code, userId);

        } catch (error) {
            logger.error(`Force Join verify error for ${userId}:`, error);
            await ctx.answerCbQuery('❌ Verification error. Please try again.');
        }
    });
};
