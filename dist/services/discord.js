"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordClient = void 0;
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const discordClient = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildMembers,
    ],
});
exports.discordClient = discordClient;
// login to discord with your bot token
discordClient.login(process.env.DISCORD_APP_BOT_TOKEN);
