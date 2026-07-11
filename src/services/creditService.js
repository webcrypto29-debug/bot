const db = require('./db');

class CreditService {
    /**
     * Reusable method to add credits (earn)
     */
    async addCredits(userId, amount) {
        if (amount <= 0) return;
        await db.updateCredits(userId, amount, 'EARN');
    }

    /**
     * Reusable method to deduct credits (spend)
     */
    async spendCredits(userId, amount) {
        if (amount <= 0) return;
        await db.updateCredits(userId, -amount, 'SPEND');
    }

    /**
     * Check if user has enough credits
     */
    async hasEnoughCredits(userId, cost) {
        const user = await db.getUser(userId);
        if (!user) return false;
        return (user.credits || 0) >= cost;
    }
}

module.exports = new CreditService();
