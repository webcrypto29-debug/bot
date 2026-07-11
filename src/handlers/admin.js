const { adminCheck } = require('../middlewares/auth');
const dbService = require('../services/dbService');

module.exports = (bot) => {
    const sendDashboard = async (ctx) => {
        try {
            const u = await dbService.getCollectionCount('users');
            const f = await dbService.getCollectionCount('files');
            const r = await dbService.getRevenue();

            let text = `🚀 *Erica Admin Dashboard*\n\n` +
                       `👥 Total Users: \`${u}\`\n` +
                       `📁 Total Files: \`${f}\`\n` +
                       `💰 Revenue: *₹${r}*`;

            const kb = {
                inline_keyboard: [
                    [{ text: '📑 Generate Link', callback_data: 'admin_links' }, { text: '📦 Batch Link', callback_data: 'admin_batch' }],
                    [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }, { text: '⚙️ Settings', callback_data: 'admin_settings' }],
                    [{ text: '🔙 Back', callback_data: 'user_back' }]
                ]
            };

            if (ctx.callbackQuery) {
                await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
            } else {
                await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
            }
        } catch (error) {
            console.error('Admin Dashboard Error:', error);
            await ctx.reply('❌ Error loading admin dashboard.');
        }
    };

    bot.command('admin', adminCheck, sendDashboard);
    bot.action('admin_panel_start', adminCheck, sendDashboard);
};
