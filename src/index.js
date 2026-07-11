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
        const modules = ['user', 'admin', 'ads', 'shortlinks', 'payments', 'forcejoin', 'links'];
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

        // Express Server for Ads/Health
        // Using path.join with process.cwd() for cross-platform stability
        const publicPath = path.join(process.cwd(), 'src', 'public');
        app.use(express.static(publicPath));

        app.get('/', (req, res) => res.send('Erica Bot Live!'));
        app.get('/ad', (req, res) => {
            res.sendFile(path.join(publicPath, 'ad.html'));
        });

        const port = process.env.PORT || 3000;
        app.listen(port, '0.0.0.0', () => logger.info(`Server Online on port ${port}`));

        await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
        logger.info(`✅ Bot @${config.botUsername} is Live!`);

    } catch (err) {
        logger.error('Bootstrap failed:', err);
    }
}

bootstrap();
