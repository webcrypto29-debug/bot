const dbService = require('./dbService');
const { generateUniqueCode } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Advanced Service for Link and Batch Management.
 */
class FileService {
    /**
     * Generates a single file link or a batch link.
     * @param {Object} data - Metadata for the file or batch.
     */
    async generateLink(data) {
        try {
            let code;
            let isUnique = false;

            // Generate unique code
            while (!isUnique) {
                code = data.isBatch ? `BATCH-${generateUniqueCode(6)}` : generateUniqueCode(6);
                const existing = await dbService.getFile(code);
                if (!existing) isUnique = true;
            }

            const fileData = {
                ...data,
                code,
                createdAt: new Date(),
                downloadCount: 0,
                status: 'enabled'
            };

            await dbService.saveFile(code, fileData);
            return code;
        } catch (error) {
            logger.error('Error in generateLink:', error);
            throw error;
        }
    }

    /**
     * Validates and retrieves file/batch data.
     */
    async validateAndGetFile(code) {
        try {
            const data = await dbService.getFile(code);
            if (!data) return { valid: false, reason: 'NOT_FOUND' };
            if (data.status === 'disabled') return { valid: false, reason: 'DISABLED' };

            // Check Expiry
            if (data.expiryDate) {
                const expiry = data.expiryDate.toDate ? data.expiryDate.toDate() : new Date(data.expiryDate);
                if (expiry < new Date()) return { valid: false, reason: 'EXPIRED' };
            }

            // Check Download Limit
            if (data.downloadLimit > 0 && data.downloadCount >= data.downloadLimit) {
                return { valid: false, reason: 'LIMIT_REACHED' };
            }

            return { valid: true, file: data };
        } catch (error) {
            logger.error(`Error validating code ${code}:`, error);
            throw error;
        }
    }

    async updateFileStatus(code, status) {
        return await dbService.updateFile(code, { status });
    }

    async deleteFile(code) {
        return await dbService.deleteFile(code);
    }
}

module.exports = new FileService();
