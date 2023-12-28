"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.botpressChatClient = void 0;
const chat_1 = require("@botpress/chat");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const myWebhookId = process.env.BOTPRESS_CHAT_WEBHOOK_ID;
const botpressChatClient = new chat_1.Client({
    apiUrl: `https://chat.botpress.cloud/${myWebhookId}`,
});
exports.botpressChatClient = botpressChatClient;
