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
exports.getOrCreateConversation = exports.getOrCreateUser = exports.sendMessageToBotpress = exports.botpressChatClient = exports.addConversationListener = void 0;
const chat_1 = require("@botpress/chat");
const dotenv_1 = require("dotenv");
const discord_1 = require("./discord");
const json_1 = require("./json");
(0, dotenv_1.config)();
const myWebhookId = process.env.BOTPRESS_CHAT_WEBHOOK_ID;
const botpressChatClient = new chat_1.Client({
    apiUrl: `https://chat.botpress.cloud/${myWebhookId}`,
});
exports.botpressChatClient = botpressChatClient;
function sendMessageToBotpress(discordUserId, conversationId, conversationPayload, messagePayload, userPayload) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield botpressChatClient.createMessage({
                xChatKey: (0, discord_1.generateChatKey)(discordUserId),
                conversationId,
                payload: {
                    // stringify message payload
                    // "text": messagePayload.content,
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
exports.sendMessageToBotpress = sendMessageToBotpress;
// gets or creates a user in botpress
function getOrCreateUser(xChatKey, authorFid) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const existingUser = yield botpressChatClient.getUser({ xChatKey });
            console.log("[CHAT-SERVER]: Found the existing user's data in Botpress 🔎");
            return existingUser.user;
        }
        catch (error) {
            console.log("[CHAT-SERVER]: Error finding the user's data in Botpress ❌", error);
            try {
                const newlyCreatedUser = yield botpressChatClient.createUser({
                    fid: authorFid,
                });
                console.log('[CHAT-SERVER]: Created a new user in Botpress ✅');
                return newlyCreatedUser.user;
            }
            catch (error) {
                console.log('[CHAT-SERVER]: Error creating a new user in Botpress ❌', error);
                return null;
            }
        }
    });
}
exports.getOrCreateUser = getOrCreateUser;
function getOrCreateConversation(xChatKey, channelFid) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const conversation = yield botpressChatClient.getOrCreateConversation({
                xChatKey,
                fid: channelFid,
            });
            console.log('[CHAT-SERVER]: Found or created the conversation data in Botpress 🔎');
            return conversation.conversation;
        }
        catch (error) {
            console.log('[CHAT-SERVER]: Error finding the conversation data in Botpress ❌', error);
            return null;
        }
    });
}
exports.getOrCreateConversation = getOrCreateConversation;
function addConversationListener(conversationId
// channelId: string
) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (!conversationId) {
            console.log('[CHAT-SERVER]:[BOTPRESS-LISTENER] ConversationId not provided ❌');
            return;
        }
        const botpressConversation = yield botpressChatClient.getConversation({
            id: conversationId,
            xChatKey: (0, discord_1.generateChatKey)(process.env.BOTPRESS_ADMIN_CHAT_FID || ''),
        });
        if (!botpressConversation) {
            console.log('[CHAT-SERVER]:[BOTPRESS-LISTENER] Conversation not found ❌');
            return;
        }
        const channelId = (_a = botpressConversation.conversation) === null || _a === void 0 ? void 0 : _a.fid;
        if (!channelId) {
            console.log("[CHAT-SERVER]:[BOTPRESS-LISTENER] Couldn't find fid info in conversation ❌");
            return;
        }
        const conversationChannel = (yield discord_1.discordClient.channels.fetch(channelId));
        if (!conversationChannel) {
            console.log('[CHAT-SERVER]:[BOTPRESS-LISTENER] Channel not found ❌');
            return;
        }
        const chatListener = yield botpressChatClient.listenConversation({
            id: conversationId,
            xChatKey: (0, discord_1.generateChatKey)(process.env.BOTPRESS_ADMIN_CHAT_FID || ''),
        });
        chatListener.on('message_created', (event) => __awaiter(this, void 0, void 0, function* () {
            var _b;
            const typedEvent = event;
            if (!((_b = typedEvent.payload) === null || _b === void 0 ? void 0 : _b.text)) {
                return;
            }
            console.log('[CHAT-SERVER]:[BOTPRESS-LISTENER] Received message from Botpress 💬');
            try {
                if (!typedEvent.payload) {
                    console.log('[CHAT-SERVER]:[BOTPRESS-LISTENER] Payload not found ❌');
                    return;
                }
                const conversationData = yield (0, json_1.getConversationData)(conversationId);
                if (!conversationData) {
                    console.log('[CHAT-SERVER]:[BOTPRESS-LISTENER] Interaction not found or has expired ⌛❌');
                    return;
                }
                if (typedEvent.userId === conversationData.botpressUserId) {
                    console.log('[CHAT-SERVER]:[BOTPRESS-LISTENER] Ignoring message just sent by the current user 👤❌');
                    return;
                }
                if (typedEvent.payload.text ||
                    typeof typedEvent.payload.text === 'string') {
                    // REQ14
                    // if (
                    // 	typedEvent.payload.text ===
                    // 		'STATUS_Conversation_Ignored' ||
                    // 	typedEvent.payload.text === 'STATUS_Conversation_Closed'
                    // ) {
                    // 	console.log(
                    // 		`[CHAT-SERVER]: Received ${typedEvent.payload.text}, closing listener and removing it from the set 👂💬`
                    // 	);
                    // 	chatListener.disconnect();
                    // 	listeningToConversationsSet.delete(conversation.id);
                    // 	interactionMap.delete(conversation.id);
                    // 	return;
                    // }
                    conversationChannel.send(typedEvent.payload.text.slice(0, 2000));
                    console.log(`[CHAT-SERVER]:[BOTPRESS-LISTENER] Sent message to Discord ✅`);
                }
                else {
                    console.log("[CHAT-SERVER]:[BOTPRESS-LISTENER] Can't send message to Discord, payload is empty or not a string ❌");
                }
            }
            catch (error) {
                console.log('[CHAT-SERVER]:[BOTPRESS-LISTENER] Error sending message to Discord ❌', error);
            }
        }));
    });
}
exports.addConversationListener = addConversationListener;
