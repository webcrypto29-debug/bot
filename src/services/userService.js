const dbService = require('./dbService');
const admin = require('firebase-admin');

/**
 * Service to manage User data, VIP status, and Ad timers.
 */
class UserService {
    async getUser(userId) {
        return await dbService.getUser(userId);
    }

    /**
     * Checks if user has any form of active access.
     */
    async hasActiveAccess(userId) {
        const user = await this.getUser(userId);
        if (!user) return false;

        const now = Date.now();

        // VIP Check
        if (user.vipUntil && user.vipUntil.toMillis() > now) return 'VIP';

        // Ads Check (24 Hours)
        if (user.adsUntil && user.adsUntil.toMillis() > now) return 'ADS';

        // Shortlink Check (3 Days / 72 Hours)
        if (user.shortlinkUntil && user.shortlinkUntil.toMillis() > now) return 'SHORTLINK';

        return false;
    }

    async grantVip(userId, days) {
        const until = new Date();
        until.setDate(until.getDate() + days);
        return await dbService.updateUser(userId, { vipUntil: until, status: 'VIP' });
    }

    async grantAdsAccess(userId) {
        const until = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours
        return await dbService.updateUser(userId, { adsUntil: until });
    }

    async grantShortlinkAccess(userId) {
        const until = new Date(Date.now() + 72 * 60 * 60 * 1000); // 3 Days
        return await dbService.updateUser(userId, { shortlinkUntil: until });
    }

    async incrementDownload(userId, fileCode) {
        const userRef = dbService.collection('users').doc(userId.toString());
        const fileRef = dbService.collection('files').doc(fileCode);

        await userRef.update({ downloadCount: admin.firestore.FieldValue.increment(1) });
        await fileRef.update({ downloadCount: admin.firestore.FieldValue.increment(1) });
    }
}

module.exports = new UserService();
