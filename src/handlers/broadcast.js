const { adminCheck } = require('../middlewares/auth');

module.exports = (bot) => {
    bot.action('admin_broadcast', adminCheck, async (ctx) => {
        ctx.answerCbQuery().catch(() => {});
        await ctx.editMessageText('📢 *Broadcast System*\n\nSend the message (Text, Photo, or Video) you want to broadcast to all users.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 Cancel', callback_data: 'admin_panel_start' }]]
            }
        });
    });
};
