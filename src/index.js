require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const path = require('path');
const config = require('./config/config');
const database = require('./database/database');
const logger = require('./utils/logger');

const app = express();
const bot = new Telegraf(config.botToken);

async function bootstrap() {
    try {
        database.connect();
        await config.loadDynamicSettings();

        // Middlewares
        const { userRegistration } = require('./middlewares/auth');
        const rateLimit = require('./middlewares/rateLimit');
        bot.use(rateLimit);
        bot.use(userRegistration);

        // Feature Modules
        const modules = ['user', 'admin', 'ads', 'shortlinks', 'payments', 'forcejoin'];
        modules.forEach(m => {
            try {
                require(`./handlers/${m}`)(bot);
            } catch (e) {
                logger.error(`Module ${m} failed: ${e.message}`);
            }
        });

        // Global Error Handling
        bot.catch((err) => {
            logger.error(`Bot Error: ${err.message}`);
        });

        // Express Server for Ads/Health (Hugging Face port 7860)
        app.use(express.static(path.join(__dirname, 'public')));
        app.get('/', (req, res) => res.send('Erica Bot Live on Hugging Face!'));
        app.get('/ad', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ad.html')));

        const port = process.env.PORT || 7860;
        app.listen(port, '0.0.0.0', () => logger.info(`Server Online on port ${port}`));

        await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
        logger.info(`✅ Bot @${config.botUsername} is Live!`);

    } catch (err) {
        logger.error('Bootstrap failed:', err);
    }
}

bootstrap();
