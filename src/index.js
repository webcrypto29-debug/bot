const { Telegraf } = require('telegraf');
const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config/config');

const bot = new Telegraf(config.botToken);
const app = express();

// Modular Handlers
const handlers = ['user', 'admin', 'ads', 'shortlinks'];
handlers.forEach(h => {
    try {
        require(`./handlers/${h}`)(bot);
    } catch (e) {
        console.error(`Error loading ${h} handler:`, e.message);
    }
});

// Rewarded Ad Route with Dynamic Placeholder Replacement
app.get('/ad', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'ad.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error loading ad page.');

        // Replace placeholders with real values from config
        let html = data.replace(/<!--ZONE_ID-->/g, config.monetagZoneId);
        html = html.replace(/<!--BOT_USERNAME-->/g, config.botUsername);

        res.send(html);
    });
});

app.get('/', (req, res) => res.send('Erica Portal: Online'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Ad Server listening on port ${PORT}`));

bot.launch().then(() => {
    console.log(`✅ Erica Bot @${config.botUsername} is Live!`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
