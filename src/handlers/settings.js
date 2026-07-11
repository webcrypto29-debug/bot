const { adminCheck } = require('../middlewares/auth');
const config = require('../config/config');

module.exports = (bot) => {
    bot.action('admin_settings', adminCheck, async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        const text = `⚙️ *Bot Settings*\n\n` +
                     `Current Configuration:\n` +
                     `- Credits per Ad: \`${config.credits.perAd}\`\n` +
                     `- Credits per Verify: \`${config.credits.perVerification}\`\n` +
                     `- Force Join: \`${config.forceJoin.enabled ? 'ON' : 'OFF'}\``;

        const kb = {
            inline_keyboard: [
                [{ text: '🔄 Refresh Config', callback_data: 'admin_refresh_config' }],
                [{ text: '🔙 Back', callback_data: 'admin_panel_start' }]
            ]
        };

        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    });

    bot.action('admin_refresh_config', adminCheck, async (ctx) => {
        await config.loadDynamicSettings();
        ctx.answerCbQuery('✅ Settings Refreshed', { show_alert: true });
        return bot.handleUpdate({ callback_query: { data: 'admin_settings', from: ctx.from, message: ctx.callbackQuery.message } });
    });
};
