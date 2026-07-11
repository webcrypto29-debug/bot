const admin = require('firebase-admin');
const config = require('../config/config');
const fs = require('fs');

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(fs.readFileSync(config.firebase.keyPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: config.firebase.projectId
        });
    } catch (e) {
        console.error("Firebase Init Error:", e.message);
    }
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
                rewardBlogger: 10, // Default for blogger
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
    async updateCredits(userId, amount) {
        const userRef = db.collection('users').doc(userId.toString());
        await db.runTransaction(async (t) => {
            const doc = await t.get(userRef);
            if (!doc.exists) return;
            const data = doc.data();
            if (amount > 0) {
                t.update(userRef, { credits: (data.credits || 0) + amount, totalEarned: (data.totalEarned || 0) + amount, lastUpdate: new Date() });
            } else {
                t.update(userRef, { credits: Math.max(0, (data.credits || 0) - Math.abs(amount)), totalSpent: (data.totalSpent || 0) + Math.abs(amount), lastUpdate: new Date() });
            }
        });
    },

    // Verification Sessions
    async createVerificationSession(sessionId, userId) {
        const expiry = new Date(); expiry.setMinutes(expiry.getMinutes() + 30);
        await db.collection('sessions').doc(sessionId).set({ sessionId, userId: userId.toString(), status: false, rewarded: false, createdAt: new Date(), expiresAt: expiry });
    },
    async getSession(sessionId) {
        const doc = await db.collection('sessions').doc(sessionId).get();
        return doc.exists ? doc.data() : null;
    },
    async updateSession(sessionId, data) {
        await db.collection('sessions').doc(sessionId).update(data);
    },

    // Ad Sessions
    async createAdSession(sessionId, userId) {
        const expiry = new Date(); expiry.setMinutes(expiry.getMinutes() + 15);
        await db.collection('ad_sessions').doc(sessionId).set({ sessionId, userId: userId.toString(), rewarded: false, createdAt: new Date(), expiresAt: expiry });
    },
    async getAdSession(sessionId) {
        const doc = await db.collection('ad_sessions').doc(sessionId).get();
        return doc.exists ? doc.data() : null;
    },
    async completeAdSession(sessionId) {
        await db.collection('ad_sessions').doc(sessionId).update({ rewarded: true });
    },

    /**
     * Blogger Reward Transaction
     * Handles verification, expiration, duplicate prevention, and credit addition in one atomic step.
     */
    async claimBloggerReward(sessionId, userId) {
        const sessionRef = db.collection('ad_sessions').doc(sessionId);
        const userRef = db.collection('users').doc(userId.toString());
        const settings = await this.getGlobalSettings();
        const rewardAmount = settings.rewardBlogger || 10;

        return await db.runTransaction(async (t) => {
            const sDoc = await t.get(sessionRef);
            if (!sDoc.exists) throw new Error('SESSION_NOT_FOUND');

            const session = sDoc.data();
            const now = new Date();
            const expiresAt = session.expiresAt.toDate ? session.expiresAt.toDate() : new Date(session.expiresAt);

            if (session.rewarded) throw new Error('ALREADY_REWARDED');
            if (now > expiresAt) throw new Error('SESSION_EXPIRED');

            const uDoc = await t.get(userRef);
            if (!uDoc.exists) throw new Error('USER_NOT_FOUND');

            const userData = uDoc.data();

            // 1. Update Session
            t.update(sessionRef, {
                rewarded: true,
                rewardTime: now,
                rewardSource: 'Blogger'
            });

            // 2. Update User Credits
            t.update(userRef, {
                credits: (userData.credits || 0) + rewardAmount,
                totalEarned: (userData.totalEarned || 0) + rewardAmount,
                lastUpdate: now
            });

            return { success: true, amount: rewardAmount };
        });
    },

    // Batch & File Methods (Combined Collection)
    async saveFile(code, data) {
        await db.collection('files').doc(code).set({ ...data, createdAt: new Date(), downloads: 0, isBatch: false });
    },
    async saveBatch(code, files, createdBy) {
        await db.collection('files').doc(code).set({ code, files, createdBy, createdAt: new Date(), downloads: 0, isBatch: true });
    },
    async getFile(code) {
        const doc = await db.collection('files').doc(code).get();
        return doc.exists ? doc.data() : null;
    },
    async getBatch(code) { return await this.getFile(code); },
    async batchExists(code) {
        const batch = await this.getFile(code);
        return (batch && batch.isBatch === true);
    },
    async recordDownload(userId, code) {
        const fileRef = db.collection('files').doc(code);
        const historyRef = db.collection('history').doc();
        await db.runTransaction(async (t) => {
            t.update(fileRef, { downloads: admin.firestore.FieldValue.increment(1) });
            t.set(historyRef, { userId: userId.toString(), fileCode: code, timestamp: new Date() });
        });
    },
    async recordBatchDownload(userId, code) { await this.recordDownload(userId, code); },
    async updateBatchDownloads(code) {
        await db.collection('files').doc(code).update({ downloads: admin.firestore.FieldValue.increment(1) });
    },
    async deleteBatch(code) {
        await db.collection('files').doc(code).delete();
    },

    // Payment Methods
    async savePayment(payId, data) {
        await db.collection('payments').doc(payId).set(data);
    },
    async getPayment(payId) {
        const doc = await db.collection('payments').doc(payId).get();
        return doc.exists ? doc.data() : null;
    },
    async updatePayment(payId, data) {
        await db.collection('payments').doc(payId).update(data);
    },
    async getPaymentByTransactionId(transactionId) {
        const snapshot = await db.collection('payments').where('transactionId', '==', transactionId).limit(1).get();
        return snapshot.empty ? null : snapshot.docs[0].data();
    },
    async getPendingPayments() {
        const snapshot = await db.collection('payments').where('status', '==', 'pending').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    async approvePayment(payId) {
        await db.collection('payments').doc(payId).update({ status: 'approved', approvedAt: new Date() });
    },

    // Stats
    async getAdminStats() {
        const users = await db.collection('users').count().get();
        const files = await db.collection('files').count().get();
        const fileSnap = await db.collection('files').get();
        let totalDownloads = 0;
        fileSnap.forEach(doc => { totalDownloads += (doc.data().downloads || 0); });

        const paymentsSnap = await db.collection('payments').where('status', '==', 'approved').get();
        let totalRevenue = 0;
        paymentsSnap.forEach(doc => { totalRevenue += (doc.data().amount || 0); });

        return {
            totalUsers: users.data().count,
            totalFiles: files.data().count,
            totalDownloads,
            generatedLinks: files.data().count,
            totalRevenue
        };
    }
};

module.exports = dbService;
