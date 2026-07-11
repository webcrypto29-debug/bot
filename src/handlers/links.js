const db = require('../services/db');
const config = require('../config/config');
const crypto = require('crypto');

const adminStates = new Map();

module.exports = (bot) => {
    const adminCheck = (ctx, next) => {
        if (config.adminIds.includes(ctx.from.id)) return next();
        return ctx.reply("❌ Admins only.");
    };

    const generateCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

    const getFileData = (msg) => {
        const file = msg.document || msg.video || msg.audio || (msg.photo ? msg.photo[msg.photo.length - 1] : null);
        if (!file) return null;

        return {
            file_id: file.file_id,
            file_unique_id: file.file_unique_id,
            file_name: file.file_name || msg.caption || 'Unnamed File',
            file_size: file.file_size || 0,
            mime_type: file.mime_type || 'application/octet-stream',
            caption: msg.caption || '',
            file_type: msg.document ? 'doc' : (msg.video ? 'vid' : (msg.audio ? 'aud' : 'img'))
        };
    };

    bot.action('admin_gen_link', adminCheck, async (ctx) => {
        adminStates.set(ctx.from.id, { step: 'AWAITING_FILE' });
        await ctx.editMessageText('📑 *Generate Link*\n\nForward a file from storage now.', { parse_mode: 'Markdown' });
    });

    bot.action('admin_gen_batch', adminCheck, async (ctx) => {
        adminStates.set(ctx.from.id, { step: 'AWAITING_BATCH', files: [] });
        await ctx.editMessageText('📦 *Generate Batch*\n\nForward files. Send `/done` when finished.', { parse_mode: 'Markdown' });
    });

    bot.on(['document', 'video', 'audio', 'photo'], adminCheck, async (ctx, next) => {
        const state = adminStates.get(ctx.from.id);
        if (!state) return next();

        const fileData = getFileData(ctx.message);
        if (!fileData) return;

        if (state.step === 'AWAITING_FILE') {
            const code = generateCode();
            await db.saveFile(code, fileData);
            adminStates.delete(ctx.from.id);
            ctx.reply(`✅ *Link Created*\n\n🔗 https://t.me/${config.botUsername}?start=${code}`, { parse_mode: 'Markdown' });
        } else if (state.step === 'AWAITING_BATCH') {
            state.files.push(fileData);
            ctx.reply(`➕ Added (${state.files.length}). More or /done?`);
        }
    });

    bot.command('done', adminCheck, async (ctx) => {
        const state = adminStates.get(ctx.from.id);
        if (!state || state.step !== 'AWAITING_BATCH') return;
        if (state.files.length === 0) return ctx.reply("❌ Batch empty.");

        const code = `BATCH_${generateCode()}`;
        await db.saveBatch(code, state.files, ctx.from.id);
        adminStates.delete(ctx.from.id);
        ctx.reply(`✅ *Batch Created*\n\n🔗 https://t.me/${config.botUsername}?start=${code}`, { parse_mode: 'Markdown' });
    });
};
