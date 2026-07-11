const { adminCheck } = require('../middlewares/auth');
const dbService = require('../services/dbService');
const config = require('../config/config');

module.exports = (bot) => {
    const showAdminDashboard = async (ctx, isEdit = false) => {
        if (!config.adminIds.includes(ctx.from.id)) return;

        const u = await dbService.getCollectionCount('users').catch(() => 0);
        const f = await dbService.getCollectionCount('files').catch(() => 0);
        const r = await dbService.getRevenue().catch(() => 0);

        let text = `🚀 *Erica Admin Dashboard*\n\n` +
                   `👥 Total Users: \`${u}\`\n` +
                   `📁 Total Files: \`${f}\`\n` +
                   `💰 Revenue: *₹${r}*`;

        const kb = {
            inline_keyboard: [
                [{ text: '📑 Generate Link', callback_data: 'admin_links' }, { text: '📦 Batch Link', callback_data: 'admin_batch' }],
                [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }, { text: '⚙️ Settings', callback_data: 'admin_settings' }],
                [{ text: '🔙 Back to User Menu', callback_data: 'user_back' }]
            ]
        };

        if (isEdit) {
            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb }).catch(() => {});
        } else {
            await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
        }
    };

    bot.command('admin', adminCheck, async (ctx) => showAdminDashboard(ctx));
    bot.action('admin_panel_start', adminCheck, async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        showAdminDashboard(ctx, true);
    });
};
