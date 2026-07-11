const { adminCheck } = require('../middlewares/auth');
const fileService = require('../services/fileService');
const { getFileFromMsg } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Advanced Link & Batch Generator.
 */
module.exports = (bot) => {
    const adminStates = new Map();

    // Start Single Link Generation
    bot.action('admin_links', adminCheck, async (ctx) => {
        adminStates.set(ctx.from.id, { type: 'AWAITING_SINGLE' });
        await ctx.editMessageText('📑 *Generate Link*\n\nForward **one file** from your private storage channel now.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 Cancel', callback_data: 'admin_panel_start' }]]
            }
        });
    });

    // Start Batch Link Generation
    bot.action('admin_batch', adminCheck, async (ctx) => {
        adminStates.set(ctx.from.id, { type: 'AWAITING_BATCH', files: [] });
        await ctx.editMessageText('📦 *Generate Batch*\n\nForward **multiple files** from your storage channel.\n\nWhen you are finished, send `/done`.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 Cancel', callback_data: 'admin_panel_start' }]]
            }
        });
    });

    // Handle Forwarded Messages & Text Links
    bot.on(['document', 'video', 'photo', 'audio', 'voice', 'animation', 'sticker', 'text'], adminCheck, async (ctx) => {
        const userId = ctx.from.id;
        const state = adminStates.get(userId);

        // Auto-generation logic for Admins
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

        // If not from storage and no state, ignore
        if (!isFromStorage && !state) return;

        try {
            let fileInfo;

            // Check if it's a Text Link
            if (ctx.message.text && ctx.message.text.startsWith('http')) {
                fileInfo = { fileId: ctx.message.text, type: 'url' };
            } else {
                fileInfo = getFileFromMsg(ctx.message);
            }

            if (!fileInfo) return;

            // If it's a batch state
            if (state && state.type === 'AWAITING_BATCH') {
                state.files.push({
                    fileId: fileInfo.fileId,
                    fileType: fileInfo.type,
                    caption: ctx.message.caption || ctx.message.text || ''
                });
                return ctx.reply(`➕ Added to batch (${state.files.length} total).\nSend more or /done to finish.`);
            }

            // Single Link Generation (Auto or Manual)
            const code = await fileService.generateLink({
                fileId: fileInfo.fileId,
                fileType: fileInfo.type,
                caption: ctx.message.caption || ctx.message.text || '',
                createdBy: userId,
                isBatch: false
            });

            if (state) adminStates.delete(userId);

            const link = `https://t.me/${config.botUsername}?start=${code}`;
            await ctx.reply(`✅ *Link Generated*\n\n🔗 Link: \`${link}\``, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '📤 Share Link', url: `https://t.me/share/url?url=${encodeURIComponent(link)}` }]]
                }
            });

        } catch (error) {
            logger.error('Link processing error:', error);
            await ctx.reply('❌ Error processing input.');
        }
    });

    // Handle Batch Completion
    bot.command('done', adminCheck, async (ctx) => {
        const state = adminStates.get(ctx.from.id);
        if (!state || state.type !== 'AWAITING_BATCH') return;

        if (state.files.length === 0) {
            return ctx.reply('❌ Batch is empty. Please forward some files first.');
        }

        try {
            const code = await fileService.generateLink({
                files: state.files,
                createdBy: ctx.from.id,
                isBatch: true
            });

            adminStates.delete(ctx.from.id);
            const link = `https://t.me/${config.botUsername}?start=${code}`;
            await ctx.reply(`✅ *Batch Link Generated*\n\n📦 Files: ${state.files.length}\n🔗 Link: \`${link}\``, { parse_mode: 'Markdown' });

        } catch (error) {
            logger.error('Batch generation error:', error);
            await ctx.reply('❌ Failed to generate batch link.');
        }
    });
};
