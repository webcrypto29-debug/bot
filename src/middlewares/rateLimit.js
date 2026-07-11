const logger = require('../utils/logger');

const userRequests = new Map();
const RATE_LIMIT_MS = 1000; // 1 second buffer

/**
 * Production-ready Rate Limiting Middleware.
 * Prevents flood and spam on commands and callbacks.
 */
const rateLimit = async (ctx, next) => {
    // Only apply to users, skip for technical updates
    if (!ctx.from || ctx.from.is_bot) return next();

    const userId = ctx.from.id;
    const now = Date.now();
    const lastRequest = userRequests.get(userId) || 0;

    if (now - lastRequest < RATE_LIMIT_MS) {
        if (ctx.callbackQuery) {
            return ctx.answerCbQuery('⚠️ Please wait a moment...', { show_alert: false });
        }
        return; // Silently ignore text command floods
    }

    userRequests.set(userId, now);

    // Cleanup memory periodically
    if (userRequests.size > 10000) {
        const threshold = now - (60 * 1000); // 1 minute old
        for (const [id, time] of userRequests.entries()) {
            if (time < threshold) userRequests.delete(id);
        }
    }

    return next();
};

module.exports = rateLimit;
