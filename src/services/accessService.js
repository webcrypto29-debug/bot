const dbService = require('./dbService');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Advanced Access Service to handle complex authorization checks
 * (VIP subscription validity, Ad view windows, and Shortlink expiry timers).
 */
class AccessService {
    /**
     * Checks if a user has active permissions to unlock a file.
     * @param {number} userId - Telegram User ID
     * @returns {Promise<Object>} Object containing access status and type
     */
    async verifyUserAccess(userId) {
        try {
            // Admins bypass all restrictions
            if (config.adminIds.includes(userId)) {
                return { hasAccess: true, type: 'ADMIN' };
            }

            const user = await dbService.getUser(userId);
            if (!user) {
                return { hasAccess: false, type: 'NONE' };
            }

            const now = new Date();

            // 1. Check VIP Subscription Status
            if (user.vipUntil) {
                const vipExpiry = user.vipUntil.toDate ? user.vipUntil.toDate() : new Date(user.vipUntil);
                if (vipExpiry > now) {
                    return { hasAccess: true, type: 'VIP' };
                }
            }

            // 2. Check Shortlink Complete Window Status (3 Days Access)
            if (user.shortlinkUntil) {
                const shortlinkExpiry = user.shortlinkUntil.toDate ? user.shortlinkUntil.toDate() : new Date(user.shortlinkUntil);
                if (shortlinkExpiry > now) {
                    return { hasAccess: true, type: 'SHORTLINK' };
                }
            }

            // 3. Check Ads Verification Window Status (24 Hours Access)
            if (user.adsUntil) {
                const adsExpiry = user.adsUntil.toDate ? user.adsUntil.toDate() : new Date(user.adsUntil);
                if (adsExpiry > now) {
                    return { hasAccess: true, type: 'ADS' };
                }
            }

            return { hasAccess: false, type: 'NONE' };
        } catch (error) {
            logger.error(`Error verifying user access for ${userId}:`, error);
            return { hasAccess: false, type: 'ERROR' };
        }
    }

    /**
     * Inline keyboard markup containing action items for regular users to unlock access.
     */
    getUnlockKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '📺 View Ads', callback_data: 'view_ads' }],
                [{ text: '🔗 Complete Shortlink', callback_data: 'shortlink' }],
                [{ text: '💎 Buy VIP', callback_data: 'get_vip' }]
            ]
        };
    }
}

module.exports = new AccessService();
