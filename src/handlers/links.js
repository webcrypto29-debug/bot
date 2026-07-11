const db = require('../services/db');
const config = require('../config/config');
const { v4: uuidv4 } = require('uuid'); // Install uuid via npm later

module.exports = (bot) => {
    // Single File Link Generator (Forward from Storage)
    bot.on(['document', 'video', 'photo', 'audio'], async (ctx) => {
        if (!config.adminIds.includes(ctx.from.id)) return;

        // Ensure it's forwarded
        if (!ctx.message.forward_from_chat) return ctx.reply('⚠️ Please forward a file from your storage channel.');

        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        await db.saveFile(code, {
            messageId: ctx.message.forward_from_message_id,
            caption: ctx.message.caption || '',
            type: ctx.message.document ? 'doc' : 'vid'
        });

        const link = `https://t.me/${config.botUsername}?start=${code}`;
        ctx.reply(`✅ *Link Created*\n\n🔗 \`${link}\``, { parse_mode: 'Markdown' });
    });
};
