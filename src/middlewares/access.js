const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Middleware to check if the user has joined the required channel.
 */
const forceJoin = async (ctx, next) => {
    if (!config.forceJoin.channelId) return next();

    // Skip check for admins
    if (config.adminIds.includes(ctx.from?.id)) return next();

    try {
        const member = await ctx.telegram.getChatMember(config.forceJoin.channelId, ctx.from.id);
        const allowedStatuses = ['member', 'administrator', 'creator'];

        if (allowedStatuses.includes(member.status)) {
            return next();
        }
    } catch (error) {
        logger.error(`Force Join check failed: ${error.message}`);
    }

    return ctx.reply(`Please join our channel to use this bot:\n${config.forceJoin.channelLink}`);
};

/**
 * Middleware for general access control (e.g. banned users).
 */
const accessControl = async (ctx, next) => {
    // This could check a 'banned' flag in the database
    // For now, it's a placeholder for future logic
    return next();
};

module.exports = { forceJoin, accessControl };
