const admin = require('firebase-admin');
const config = require('../config/config');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require(config.firebase.keyPath))
    });
}

const db = admin.firestore();

const dbService = {
    // Settings Methods
    async getGlobalSettings() {
        const doc = await db.collection('settings').doc('global').get();
        if (!doc.exists) {
            const defaultSettings = {
                rewardVerification: config.rewards.shortlink,
                rewardAd: config.rewards.adReward,
                downloadCost: config.rewards.costPerDownload
            };
            await db.collection('settings').doc('global').set(defaultSettings);
            return defaultSettings;
        }
        return doc.data();
    },
    async updateGlobalSettings(data) {
        await db.collection('settings').doc('global').update(data);
    },

    // User Methods
    async getUser(userId) {
        const doc = await db.collection('users').doc(userId.toString()).get();
        return doc.exists ? doc.data() : null;
    },
    async createUser(userId, data) {
        await db.collection('users').doc(userId.toString()).set({
            credits: 0,
            totalEarned: 0,
            totalSpent: 0,
            status: 'active',
            createdAt: new Date(),
            lastUpdate: new Date(),
            ...data
        }, { merge: true });
    },
    async getAllUsers() {
        const snapshot = await db.collection('users').get();
        return snapshot.docs.map(doc => doc.id);
    },

    // Credit Transaction Method
    async updateCredits(userId, amount) {
        const userRef = db.collection('users').doc(userId.toString());
        await db.runTransaction(async (t) => {
            const doc = await t.get(userRef);
            if (!doc.exists) return;

            const data = doc.data();
            const currentCredits = data.credits || 0;
            const earned = data.totalEarned || 0;
            const spent = data.totalSpent || 0;

            if (amount > 0) { // Earning
                t.update(userRef, {
                    credits: currentCredits + amount,
                    totalEarned: earned + amount,
                    lastUpdate: new Date()
                });
            } else { // Spending
                const absAmount = Math.abs(amount);
                t.update(userRef, {
                    credits: Math.max(0, currentCredits - absAmount),
                    totalSpent: spent + absAmount,
                    lastUpdate: new Date()
                });
            }
        });
    },

    // Verification Sessions (Shortlink)
    async createVerificationSession(sessionId, userId) {
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 30);
        await db.collection('sessions').doc(sessionId).set({
            sessionId,
            userId: userId.toString(),
            status: false,
            createdAt: new Date(),
            expiresAt: expiry
        });
    },
    async getSession(sessionId) {
        const doc = await db.collection('sessions').doc(sessionId).get();
        return doc.exists ? doc.data() : null;
    },

    // Ad Sessions (Monetag)
    async createAdSession(sessionId, userId) {
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 15);
        await db.collection('ad_sessions').doc(sessionId).set({
            sessionId,
            userId: userId.toString(),
            rewarded: false,
            createdAt: new Date(),
            expiresAt: expiry
        });
    },
    async getAdSession(sessionId) {
        const doc = await db.collection('ad_sessions').doc(sessionId).get();
        return doc.exists ? doc.data() : null;
    },
    async completeAdSession(sessionId) {
        await db.collection('ad_sessions').doc(sessionId).update({ rewarded: true });
    },

    // File & Batch Methods
    async saveFile(code, data) {
        await db.collection('files').doc(code).set({
            ...data,
            createdAt: new Date(),
            downloads: 0,
            isBatch: false
        });
    },
    async getFile(code) {
        const doc = await db.collection('files').doc(code).get();
        return doc.exists ? doc.data() : null;
    },
    async recordDownload(userId, code) {
        const fileRef = db.collection('files').doc(code);
        const historyRef = db.collection('history').doc();
        await db.runTransaction(async (t) => {
            t.update(fileRef, { downloads: admin.firestore.FieldValue.increment(1) });
            t.set(historyRef, { userId: userId.toString(), fileCode: code, timestamp: new Date() });
        });
    },

    // Stats
    async getAdminStats() {
        const users = await db.collection('users').count().get();
        const files = await db.collection('files').count().get();
        const fileSnap = await db.collection('files').get();
        let totalDownloads = 0;
        fileSnap.forEach(doc => { totalDownloads += (doc.data().downloads || 0); });
        return { totalUsers: users.data().count, totalFiles: files.data().count, totalDownloads, generatedLinks: files.data().count };
    }
};

module.exports = dbService;
