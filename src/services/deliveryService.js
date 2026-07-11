const dbService = require('./dbService');

class DeliveryService {
    async deliverFile(ctx, payload, userId) {
        try {
            const file = await dbService.getFile(payload);
            if (!file) return ctx.reply('❌ File not found.');

            const opts = { caption: file.caption || '', parse_mode: 'Markdown' };

            if (file.fileType === 'document') await ctx.replyWithDocument(file.fileId, opts);
            else if (file.fileType === 'video') await ctx.replyWithVideo(file.fileId, opts);
            else if (file.fileType === 'photo') await ctx.replyWithPhoto(file.fileId, opts);

            await dbService.incrementDownload(payload);
            return true;
        } catch (error) {
            console.error('Delivery Error:', error.message);
            return false;
        }
    }
}
module.exports = new DeliveryService();
