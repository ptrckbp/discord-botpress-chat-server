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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const botpress_1 = require("./services/botpress");
const dotenv_1 = require("dotenv");
const discord_1 = require("./services/discord");
const healthcheck_1 = require("./healthcheck");
const discord_js_1 = require("discord.js");
(0, dotenv_1.config)();
// set of conversations that are being listened to
const listeningToConversationsSet = new Set([]);
const interactionMap = new Map();
// gets or creates a user in botpress
function getOrCreateUser(xChatKey, authorFid) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const existingUser = yield botpress_1.botpressChatClient.getUser({ xChatKey });
            console.log("[CHAT-SERVER]: Found the existing user's data in Botpress 🔎");
            return existingUser.user;
        }
        catch (error) {
            console.log("[CHAT-SERVER]: Error finding the user's data in Botpress ❌", error);
            const newlyCreatedUser = yield botpress_1.botpressChatClient.createUser({
                xChatKey,
                fid: authorFid,
            });
            console.log('[CHAT-SERVER]: Created a new user in Botpress ✅');
            return newlyCreatedUser.user;
        }
    });
}
function getOrCreateConversation(xChatKey, channelFid) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conversation = yield botpress_1.botpressChatClient.getOrCreateConversation({
                xChatKey,
                fid: channelFid,
            });
            console.log('[CHAT-SERVER]: Found the existing conversation data in Botpress 🔎');
            return conversation.conversation;
        }
        catch (error) {
            console.log('[CHAT-SERVER]: Error finding the conversation data in Botpress ❌', error);
            return null;
        }
    });
}
function checkMessageRestrictions(message) {
    var _a, _b;
    if (message.guildId != process.env.DISCORD_SERVER_ID) {
        console.log('[CHAT-SERVER]: Ignoring message from other server ⛔');
        return false;
    }
    if (message.system) {
        console.log('[CHAT-SERVER]: Ignoring system message ⛔');
        return false;
    }
    if ((_a = message.author) === null || _a === void 0 ? void 0 : _a.bot) {
        console.log('[CHAT-SERVER]: Ignoring message from bot ⛔');
        return false;
    }
    if (((_b = message.channel) === null || _b === void 0 ? void 0 : _b.type) !== 11) {
        console.log('[CHAT-SERVER]: Ignoring message from non-thread channel ⛔');
        return false;
    }
    return true;
}
// checks if botpress is up and running
discord_1.discordClient.once(discord_js_1.Events.ClientReady, healthcheck_1.startHealthCheckBeacon);
// listen to new messages from discord
discord_1.discordClient.on(discord_js_1.Events.MessageCreate, (interaction) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("[CHAT-SERVER]: There's a new user message! 🆕", interaction.cleanContent);
    try {
        if (!checkMessageRestrictions(interaction)) {
            return;
        }
        const parsedInteraction = parseDiscordInteraction(interaction);
        if (!parsedInteraction) {
            console.log('[CHAT-SERVER]: Could not get parsed interaction ❌');
            return;
        }
        if (!parsedInteraction.author || !parsedInteraction.author.id) {
            console.log('[CHAT-SERVER]: Author data not found in interaction ❌');
            return;
        }
        const xChatKey = jsonwebtoken_1.default.sign({ fid: (_a = parsedInteraction.author) === null || _a === void 0 ? void 0 : _a.id }, process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || '');
        // 1. gets or creates a user in botpress
        const botpressUser = yield getOrCreateUser(xChatKey, parsedInteraction.author.id);
        if (!botpressUser) {
            console.log('[CHAT-SERVER]: Error finding or creating user in Botpress ❌');
            return;
        }
        // 2. creates a conversation
        const conversation = yield getOrCreateConversation(xChatKey, parsedInteraction.channelId);
        if (!conversation) {
            console.log('[CHAT-SERVER]: Error finding or creating conversation in Botpress ❌');
            return;
        }
        const messagePayload = {};
        // REQ03
        // check if there is an attachment that's not a link preview
        if (interaction.attachments.size > 0) {
            console.log('Ignoring message with attachments');
            messagePayload.action = 'ignore_conversation';
        }
        else {
            messagePayload.content = parsedInteraction.content;
        }
        const conversationPayload = {
            type: 'thread',
            parentName: parsedInteraction.parentChannelName,
            threadName: parsedInteraction.channelName,
            threadId: parsedInteraction.channelId, // added
            url: parsedInteraction.url,
        };
        const userPayload = {
            guildRoles: parsedInteraction.guildRoles,
            nickname: parsedInteraction.author.username,
            name: parsedInteraction.author.globalName,
            authorId: parsedInteraction.author.id, // added
        };
        // 3. sends the message to botpress
        console.log('[CHAT-SERVER]: Sending message to Botpress ✉️');
        yield sendMessageToBotpress(xChatKey, conversation.id, conversationPayload, messagePayload, userPayload);
        if (!listeningToConversationsSet.has(conversation.id)) {
            console.log(`[CHAT-SERVER]: Listening to new conversation (${conversation.id}) 👂🆕`);
            listeningToConversationsSet.add(conversation.id);
            interactionMap.set(conversation.id, interaction);
            // could add a timeout here
        }
        else {
            console.log(`[CHAT-SERVER]: Already listening to this conversation (${conversation.id}) 👂✅`);
            return;
        }
        // 4. listens to messages from botpress
        const chatListener = yield botpress_1.botpressChatClient.listenConversation({
            id: conversation.id,
            xChatKey,
        });
        // 5. sends messages from botpress to discord
        chatListener.on('message_created', (event) => __awaiter(void 0, void 0, void 0, function* () {
            console.log('[CHAT-SERVER]: Received message from Botpress 💬');
            try {
                const typedEvent = event;
                const conversationInteraction = interactionMap.get(conversation.id);
                if (!conversationInteraction) {
                    console.log('[CHAT-SERVER]: Interaction not found or has expired ⌛❌');
                    return;
                }
                if (typedEvent.userId === botpressUser.id) {
                    console.log('[CHAT-SERVER]: Ignoring message just sent by the current user 👤❌');
                    return;
                }
                if (typedEvent.payload.text ||
                    typeof typedEvent.payload.text === 'string') {
                    conversationInteraction.reply(typedEvent.payload.text.slice(0, 2000));
                }
                else {
                    console.log("[CHAT-SERVER]: Can't send message to Discord, payload is empty or not a string ❌");
                }
            }
            catch (error) {
                console.log('[CHAT-SERVER]: Error sending message to Discord ❌', error);
            }
        }));
    }
    catch (error) {
        console.log('[CHAT-SERVER]: Error when processing message created ❌', error);
    }
}));
// send payload to botpress to ignore conversation when message is edited
discord_1.discordClient.on(discord_js_1.Events.MessageUpdate, (oldMessage, newMessage) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('[CHAT-SERVER]: A message was updated! 📝');
    try {
        if (!checkMessageRestrictions(newMessage)) {
            return;
        }
        const parsedInteraction = parseDiscordInteraction(oldMessage);
        if (!parsedInteraction) {
            console.log('[CHAT-SERVER]: Could not get parsed interaction ❌');
            return;
        }
        if (!parsedInteraction.author || !parsedInteraction.author.id) {
            console.log('[CHAT-SERVER]: Author data not found in interaction ❌');
            return;
        }
        const xChatKey = jsonwebtoken_1.default.sign({ fid: parsedInteraction.author.id }, process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || '');
        // 1. creates a conversation
        const conversation = yield getOrCreateConversation(xChatKey, parsedInteraction.channelId);
        if (!conversation) {
            console.log('[CHAT-SERVER]: Error finding or creating conversation in Botpress ❌');
            return;
        }
        const conversationPayload = {
            type: 'thread',
            threadId: parsedInteraction.channelId, // added
        };
        const messagePayload = {
            action: 'ignore_conversation',
        };
        // REQ02
        // 2. sends the payload to ignore to botpress
        console.log('[CHAT-SERVER]: Sending payload to Botpress ✉️');
        yield sendMessageToBotpress(xChatKey, conversation.id, conversationPayload, messagePayload);
        // 4. removes the conversation from the listeners
        listeningToConversationsSet.delete(conversation.id);
        interactionMap.delete(conversation.id);
        console.log(`[CHAT-SERVER]: Interaction for conversation ${conversation.id} has been removed due to message edit 📝`);
    }
    catch (error) {
        console.log('[CHAT-SERVER]: Error while processing message updated ❌', error);
    }
}));
function sendMessageToBotpress(xChatKey, conversationId, conversationPayload, messagePayload, userPayload) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield botpress_1.botpressChatClient.createMessage({
                xChatKey,
                conversationId,
                payload: {
                    type: 'custom',
                    payload: {
                        conversation: conversationPayload,
                        message: messagePayload,
                        user: userPayload,
                    },
                },
            });
            console.log('[CHAT-SERVER]: Message sent to Botpress ✅');
        }
        catch (error) {
            console.error('[CHAT-SERVER]: Error while sending message to Botpress ❌', error);
        }
    });
}
function parseDiscordInteraction(interactionRaw) {
    var _a, _b, _c;
    try {
        const clonedInteraction = interactionRaw;
        const authorData = (_a = clonedInteraction.author) === null || _a === void 0 ? void 0 : _a.toJSON();
        const parsed = {
            content: clonedInteraction.cleanContent || '',
            author: authorData,
            guildRoles: ((_b = clonedInteraction.member) === null || _b === void 0 ? void 0 : _b.roles.cache.map((a) => `[${a.name}]`).join(' ')) || '',
            parentChannelName: ((_c = clonedInteraction.channel.parent) === null || _c === void 0 ? void 0 : _c.name) || '',
            channelName: clonedInteraction.channel.name,
            channelId: clonedInteraction.channelId,
            url: clonedInteraction.url,
        };
        return parsed;
    }
    catch (error) {
        console.log('[CHAT-SERVER]: Error parsing interaction ❌', error);
        return null;
    }
}
