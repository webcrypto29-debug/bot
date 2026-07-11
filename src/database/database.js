const admin = require('firebase-admin');
const config = require('../config/config');
const fs = require('fs');

class Database {
    connect() {
        try {
            if (admin.apps.length > 0) return admin.firestore();
            const serviceAccount = JSON.parse(fs.readFileSync(config.firebase.serviceAccountPath, 'utf8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: config.firebase.projectId
            });
            const db = admin.firestore();
            db.settings({ ignoreUndefinedProperties: true });
            return db;
        } catch (error) {
            console.error('Firebase Error:', error.message);
            throw error;
        }
    }
    getInstance() { return this.connect(); }
}
module.exports = new Database();
