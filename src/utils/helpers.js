const crypto = require('crypto');

/**
 * Utility functions and helpers.
 */

/**
 * Generates a unique random alphanumeric code.
 * @param {number} length - The length of the code.
 * @returns {string}
 */
const generateUniqueCode = (length = 8) => {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length)
        .toUpperCase();
};

/**
 * Extracts the file ID and type from a message.
 */
const getFileFromMsg = (message) => {
    if (message.document) return { fileId: message.document.file_id, type: 'document' };
    if (message.video) return { fileId: message.video.file_id, type: 'video' };
    if (message.audio) return { fileId: message.audio.file_id, type: 'audio' };
    if (message.voice) return { fileId: message.voice.file_id, type: 'voice' };
    if (message.animation) return { fileId: message.animation.file_id, type: 'animation' };
    if (message.sticker) return { fileId: message.sticker.file_id, type: 'sticker' };
    if (message.photo) {
        // Photos come in an array, take the highest resolution
        const photo = message.photo[message.photo.length - 1];
        return { fileId: photo.file_id, type: 'photo' };
    }
    return null;
};

module.exports = {
    generateUniqueCode,
    getFileFromMsg
};
