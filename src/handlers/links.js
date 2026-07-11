const { adminCheck } = require('../middlewares/auth');
const fileService = require('../services/fileService');
const { getFileFromMsg } = require('../utils/helpers');
const config = require('../config/config');

module.exports = (bot) => {
    bot.on(['document', 'video', 'photo', 'audio', 'voice', 'animation'], adminCheck, async (ctx) => {
        try {
            const fileInfo = getFileFromMsg(ctx.message);
            if (!fileInfo) return;

            const code = await fileService.generateLink({
                fileId: fileInfo.fileId,
                fileType: fileInfo.type,
                caption: ctx.message.caption || 'No Caption',
                createdBy: ctx.from.id,
                isBatch: false
            });

            const link = `https://t.me/${config.botUsername}?start=${code}`;
            const text = `✅ *Link Generated Successfully!*\n\n` +
                         `📂 *File:* ${ctx.message.caption || 'No Title'}\n` +
                         `🔗 *Link:* \`${link}\`\n\n` +
                         `Users will need *1 Credit* to unlock this file. They can earn credits by watching ads or completing verification.`;

            const kb = [
                [{ text: '📤 Share Link', url: `https://t.me/share/url?url=${encodeURIComponent(link)}` }],
                [{ text: '🔗 Open Link', url: link }]
            ];

            await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        } catch (error) {
            await ctx.reply('❌ Database Error. Check Firebase connection.');
        }
    });
};
