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
exports.getOrCreateConversation = exports.getOrCreateUser = exports.sendMessageToBotpress = exports.botpressChatClient = void 0;
const chat_1 = require("@botpress/chat");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const myWebhookId = process.env.BOTPRESS_CHAT_WEBHOOK_ID;
const botpressChatClient = new chat_1.Client({
    apiUrl: `https://chat.botpress.cloud/${myWebhookId}`,
});
exports.botpressChatClient = botpressChatClient;
function sendMessageToBotpress(xChatKey, conversationId, conversationPayload, messagePayload, userPayload) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield botpressChatClient.createMessage({
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
                    xChatKey,
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
