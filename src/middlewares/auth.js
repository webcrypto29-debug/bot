const config = require('../config/config');
const dbService = require('../services/dbService');
const logger = require('../utils/logger');

/**
 * Middleware to check if the user is an admin.
 */
const adminCheck = async (ctx, next) => {
    const userId = ctx.from?.id;
    if (config.adminIds.includes(userId)) {
        return next();
    }
    // Agar callback query hai toh alert dikhayein
    if (ctx.callbackQuery) {
        return ctx.answerCbQuery('⚠️ This action is for Admins only!', { show_alert: true });
    }
    // Agar command hai toh message bhej sakte hain (optional)
    return;
};

/**
 * Middleware to ensure the user is registered in the database.
 */
const userRegistration = async (ctx, next) => {
    if (!ctx.from) return next();

    try {
        const userId = ctx.from.id;
        let user = await dbService.getUser(userId);

        if (!user) {
            const userData = {
                username: ctx.from.username || null,
                firstName: ctx.from.first_name || '',
                lastName: ctx.from.last_name || '',
                isBot: ctx.from.is_bot,
                languageCode: ctx.from.language_code || 'en',
                status: 'active',
            };
            await dbService.createUser(userId, userData);
            logger.info(`New user registered: ${userId}`);
        }
    } catch (error) {
        logger.error(`Error in userRegistration middleware: ${error.message}`);
    }

    return next();
};

module.exports = { adminCheck, userRegistration };
