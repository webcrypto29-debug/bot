const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function testConnection() {
    console.log('--- Firebase Diagnostic Start ---');

    const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');

    if (!fs.existsSync(keyPath)) {
        console.error('❌ Error: serviceAccountKey.json nahi mili!');
        return;
    }

    try {
        const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        console.log('✅ Service Account JSON load ho gayi.');
        console.log('Project ID:', serviceAccount.project_id);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        const db = admin.firestore();
        console.log('⏳ Firestore se connect karne ki koshish kar raha hoon...');

        // Ek chota sa test write
        await db.collection('test').doc('ping').set({
            time: new Date(),
            message: 'Hello from Bot'
        });

        console.log('✅ SUCCESS: Firestore mein data write ho gaya!');
        console.log('Aapka Firebase setup bilkul sahi kaam kar raha hai.');

    } catch (error) {
        console.error('❌ Error Mil Gaya:');
        console.error('Code:', error.code);
        console.error('Message:', error.message);

        if (error.message.includes('NOT_FOUND')) {
            console.log('\n💡 SOLUTION: Aapne abhi tak Firestore Database CREATE nahi kiya hai.');
            console.log('Firebase Console > Build > Firestore Database par jayein aur "Create Database" par click karein.');
        } else if (error.message.includes('PERMISSION_DENIED')) {
            console.log('\n💡 SOLUTION: Cloud Firestore API disabled ho sakti hai.');
            console.log('Is link par jayein: https://console.cloud.google.com/apis/library/firestore.googleapis.com');
            console.log('Wahan "Enable" button par click karein.');
        }
    }
    process.exit();
}

testConnection();
