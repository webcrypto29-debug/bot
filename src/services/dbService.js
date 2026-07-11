const database = require('../database/database');
const admin = require('firebase-admin');

class DbService {
    constructor() { this.db = database.getInstance(); }

    async getSettings() {
        try { const doc = await this.db.collection('settings').doc('config').get(); return doc.exists ? doc.data() : {}; }
        catch (e) { return {}; }
    }

    async saveSettings(data) { await this.db.collection('settings').doc('config').set(data, { merge: true }); }

    async getUser(userId) {
        try {
            const doc = await this.db.collection('users').doc(userId.toString()).get();
            return doc.exists ? doc.data() : null;
        } catch (e) { return null; }
    }

    async updateUser(userId, data) { await this.db.collection('users').doc(userId.toString()).set(data, { merge: true }); }

    async addCredits(userId, amount) {
        const user = await this.getUser(userId);
        await this.updateUser(userId, { credits: (user?.credits || 0) + amount });
    }

    async deductCredit(userId) {
        const user = await this.getUser(userId);
        if (user && user.credits > 0) {
            await this.updateUser(userId, { credits: user.credits - 1 });
            return true;
        }
        return false;
    }

    async getFile(code) {
        const doc = await this.db.collection('files').doc(code).get();
        return doc.exists ? doc.data() : null;
    }

    async incrementDownload(code) {
        await this.db.collection('files').doc(code).update({ downloadCount: admin.firestore.FieldValue.increment(1) });
    }

    async getCollectionCount(col) {
        const snap = await this.db.collection(col).count().get();
        return snap.data().count;
    }

    async getRevenue() {
        const snap = await this.db.collection('payments').where('status', '==', 'approved').get();
        let t = 0;
        snap.forEach(d => t += (d.data().amount || 0));
        return t;
    }
}

module.exports = new DbService();
