const dbService = require('./dbService');
const logger = require('../utils/logger');

/**
 * Service to handle payment requests and admin approvals.
 */
class PaymentService {
    async createPaymentRequest(userId, data) {
        const requestId = `PAY_${Date.now()}`;
        await dbService.collection('payment_requests').doc(requestId).set({
            userId,
            ...data,
            status: 'pending',
            createdAt: new Date()
        });
        return requestId;
    }

    async getRequest(requestId) {
        const doc = await dbService.collection('payment_requests').doc(requestId).get();
        return doc.exists ? doc.data() : null;
    }

    async approvePayment(requestId) {
        await dbService.collection('payment_requests').doc(requestId).update({ status: 'approved' });
        logger.info(`Payment ${requestId} approved.`);
    }
}

module.exports = new PaymentService();
