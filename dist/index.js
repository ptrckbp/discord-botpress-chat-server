"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const discord_js_1 = require("discord.js");
const json_1 = require("./services/json");
const healthcheck_1 = require("./healthcheck");
const botpress_1 = require("./services/botpress");
const discord_1 = require("./services/discord");
(0, dotenv_1.config)();
function initializeListeners() {
    const adminFid = process.env.BOTPRESS_ADMIN_CHAT_FID || '';
    // create admin user in botpress
    (() => __awaiter(this, void 0, void 0, function* () {
        try {
            if (yield botpress_1.botpressChatClient.getUser({
                xChatKey: (0, discord_1.generateChatKey)(adminFid),
            })) {
                console.log('[CHAT-SERVER]: Admin user already exists in Botpress ✅');
            }
            else {
                console.log('[CHAT-SERVER]: Admin user does not exist in Botpress ❌');
                yield botpress_1.botpressChatClient.createUser({
                    fid: adminFid,
                    name: 'Admin',
                });
                console.log('[CHAT-SERVER]: Admin user created in Botpress ✅');
            }
        }
        catch (error) {
            console.log('[CHAT-SERVER]: Error creating or retrieving admin user in Botpress ❌', error);
        }
        // start listening to all conversations stored
        try {
            console.log('[CHAT-SERVER]: Retrieving active conversations 🔎');
            const activeConversations = yield (0, json_1.getActiveConversations)();
            console.log(`[CHAT-SERVER]: Found ${Object.keys(activeConversations).length} active conversations 🔎`);
            if (Object.keys(activeConversations).length) {
                console.log('[CHAT-SERVER]: Adding listener for active conversations ✅');
                for (const conversationId in activeConversations) {
                    try {
                        yield (0, botpress_1.addConversationListener)(conversationId);
                        console.log(`[CHAT-SERVER]: Started listening to conversation (${conversationId}) 👂🆕`);
                    }
                    catch (error) {
                        console.log(`[CHAT-SERVER]: Error listening to conversation (${conversationId}) ❌`, error);
                    }
                }
            }
        }
        catch (error) {
            console.log('[CHAT-SERVER]: Error retrieving active conversations from database ❌', error);
        }
    }))();
    discord_1.discordClient.on('ready', () => {
        console.log('[CHAT-SERVER]: Discord client is ready ✅');
    });
    // checks if botpress is up and running
    discord_1.discordClient.once(discord_js_1.Events.ClientReady, healthcheck_1.startHealthCheckBeacon);
    // listen to new messages from discord
    discord_1.discordClient.on(discord_js_1.Events.MessageCreate, (interaction) => __awaiter(this, void 0, void 0, function* () {
        console.log(`[CHAT-SERVER]: There's a new user message! 🆕 : "${interaction.cleanContent}"`);
        (0, discord_1.handleMessageCreated)(interaction);
    }));
    // send payload to botpress to ignore conversation when message is edited
    discord_1.discordClient.on(discord_js_1.Events.MessageUpdate, (oldMessage, newMessage) => __awaiter(this, void 0, void 0, function* () {
        console.log(`[CHAT-SERVER]: A message was updated! 📝 : "${oldMessage.cleanContent}" => "${newMessage.cleanContent}"`);
        (0, discord_1.handleMessageUpdated)(oldMessage, newMessage);
    }));
}
initializeListeners();
