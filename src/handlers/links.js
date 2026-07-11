const { adminCheck } = require('../middlewares/auth');
const fileService = require('../services/fileService');
const { getFileFromMsg } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config/config');

module.exports = (bot) => {
    const adminStates = new Map();

    // Start Single Link Generation
    bot.action('admin_links', adminCheck, async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        adminStates.set(ctx.from.id, { type: 'AWAITING_SINGLE' });
        await ctx.editMessageText('📑 *Manual Link Generation*\n\nForward a file from your storage channel now.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 Cancel', callback_data: 'admin_panel_start' }]]
            }
        });
    });

    // Start Batch Link Generation
    bot.action('admin_batch', adminCheck, async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        adminStates.set(ctx.from.id, { type: 'AWAITING_BATCH', files: [] });
        await ctx.editMessageText('📦 *Batch Link Generation*\n\nForward multiple files. Send `/done` when finished.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 Cancel', callback_data: 'admin_panel_start' }]]
            }
        });
    });

    // Handle Messages (For Link Generation)
    bot.on(['document', 'video', 'photo', 'audio', 'voice', 'animation', 'sticker'], adminCheck, async (ctx) => {
        const userId = ctx.from.id;
        const state = adminStates.get(userId);

        // Detect if forwarded from storage
        const forwardChat = ctx.message.forward_from_chat;
        const expectedChannel = config.storageChannel.replace('@', '').toLowerCase();

        let isFromStorage = false;
        if (forwardChat && forwardChat.type === 'channel') {
            if (forwardChat.username && forwardChat.username.toLowerCase() === expectedChannel) {
                isFromStorage = true;
            } else if (forwardChat.id.toString() === config.storageChannel) {
                isFromStorage = true;
            }
        }

        // Auto-generate link for Admin even without state if it's from storage
        if (!state && !isFromStorage) return;

        try {
            const fileInfo = getFileFromMsg(ctx.message);
            if (!fileInfo) return;

            if (state && state.type === 'AWAITING_BATCH') {
                state.files.push({
                    fileId: fileInfo.fileId,
                    fileType: fileInfo.type,
                    caption: ctx.message.caption || ''
                });
                return ctx.reply(`➕ Added (${state.files.length}). Send more or /done.`);
            }

            // Single Link (Manual or Auto)
            const code = await fileService.generateLink({
                fileId: fileInfo.fileId,
                fileType: fileInfo.type,
                caption: ctx.message.caption || '',
                createdBy: userId,
                isBatch: false
            });

            const link = `https://t.me/${config.botUsername}?start=${code}`;
            await ctx.reply(`✅ *Link Generated*\n\n🔗 Link: \`${link}\``, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '📤 Share', url: `https://t.me/share/url?url=${encodeURIComponent(link)}` }]]
                }
            });

            if (state) adminStates.delete(userId);

        } catch (error) {
            logger.error('Link generation error:', error);
            await ctx.reply('❌ Failed to generate link.');
        }
    });

    bot.command('done', adminCheck, async (ctx) => {
        const state = adminStates.get(ctx.from.id);
        if (!state || state.type !== 'AWAITING_BATCH' || state.files.length === 0) return;

        const code = await fileService.generateLink({
            files: state.files,
            createdBy: ctx.from.id,
            isBatch: true
        });

        adminStates.delete(ctx.from.id);
        const link = `https://t.me/${config.botUsername}?start=${code}`;
        await ctx.reply(`✅ *Batch Created*\n\n📦 Total: ${state.files.length}\n🔗 Link: \`${link}\``, { parse_mode: 'Markdown' });
    });
};
