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
exports.parseDiscordInteraction = exports.handleMessageUpdated = exports.handleMessageCreated = exports.discordClient = exports.generateChatKey = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const functions_1 = require("../utils/functions");
const dotenv_1 = require("dotenv");
const discord_js_1 = require("discord.js");
const botpress_1 = require("./botpress");
const json_1 = require("./json");
function generateChatKey(fid) {
    return jsonwebtoken_1.default.sign({ fid }, process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || '');
}
exports.generateChatKey = generateChatKey;
(0, dotenv_1.config)();
const adminChatKey = generateChatKey(process.env.BOTPRESS_ADMIN_CHAT_FID || '');
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
function handleMessageCreated(interaction) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!(0, functions_1.checkMessageRestrictions)(interaction)) {
                return;
            }
            const parsedInteraction = parseDiscordInteraction(interaction);
            if (!parsedInteraction) {
                console.log('[CHAT-SERVER]: Could not get parsed interaction ❌');
                return;
            }
            // console.log('[CHAT-SERVER]: Parsed interaction', parsedInteraction);
            if (!parsedInteraction.author || !parsedInteraction.author.id) {
                console.log('[CHAT-SERVER]: Author data not found in interaction ❌');
                return;
            }
            // console.log(
            // 	`[CHAT-SERVER]: Looking for the thread among ${channelAuthorMap.size} items 🔎`
            // );
            // if (channelAuthorMap.has(parsedInteraction.channelId)) {
            // 	console.log('[CHAT-SERVER]: Found thread for this channel ✅');
            // 	authorChatKey = generateChatKey(
            // 		channelAuthorMap.get(parsedInteraction.channelId) || ''
            // 	);
            // } else {
            // 	console.log('[CHAT-SERVER]: Creating thread for this channel 🆕');
            // 	channelAuthorMap.set(
            // 		parsedInteraction.channelId,
            // 		parsedInteraction.author.id
            // 	);
            // }
            const userChatKey = generateChatKey(parsedInteraction.author.id);
            // 1. gets or creates a conversation
            const conversation = yield (0, botpress_1.getOrCreateConversation)(adminChatKey, parsedInteraction.channelId);
            if (!conversation) {
                console.log('[CHAT-SERVER]: Error finding or creating conversation in Botpress ❌');
                return;
            }
            // 2. gets or creates a user in botpress
            const botpressUser = yield (0, botpress_1.getOrCreateUser)(userChatKey, parsedInteraction.author.id);
            if (!botpressUser) {
                console.log('[CHAT-SERVER]: Error finding or creating user in Botpress ❌');
                return;
            }
            // every new user
            console.log("[CHAT-SERVER]: Looking for user in conversation's participants 🔎");
            const conversationParticipants = yield botpress_1.botpressChatClient.listParticipants({
                id: conversation.id,
                xChatKey: adminChatKey,
            });
            if (!conversationParticipants.participants.find((participant) => participant.id === botpressUser.id)) {
                console.log("[CHAT-SERVER]: User wasn't found in the conversation list, adding it⏳");
                yield botpress_1.botpressChatClient.addParticipant({
                    id: conversation.id,
                    xChatKey: adminChatKey,
                    userId: botpressUser.id,
                });
                console.log('[CHAT-SERVER]: User added to conversation list ✅');
            }
            const messagePayload = {};
            // REQ03, REQ13
            // check if there is an attachment that's not a link preview
            if (interaction.attachments.size > 0) {
                console.log('[CHAT-SERVER]: Ignoring message with attachments ❌');
                console.log('[CHAT-SERVER]: Sending payload to ignore conversation ✉️');
                messagePayload.content = 'ACTION_Ignore_Conversation';
                messagePayload.ignoringReason = 'The user has sent attachments';
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
            yield (0, botpress_1.sendMessageToBotpress)(parsedInteraction.author.id, conversation.id, conversationPayload, messagePayload, userPayload);
            // if (messagePayload.content === 'ACTION_Ignore_Conversation') {
            // 	console.log(
            // 		'[CHAT-SERVER]: Not adding conversation to listeners because it will be ignored 👂❌'
            // 	);
            // 	return;
            // }
            if (yield (0, json_1.isConversationBeingListened)(conversation.id)) {
                console.log(`[CHAT-SERVER]: Already listening to this conversation 👂✅ `);
                yield (0, json_1.updateConversationData)(conversation.id, {
                    botpressUserId: botpressUser.id,
                });
                console.log('[CHAT-SERVER]: Updated conversation with the id of the last user that interacted ✅');
                return;
            }
            else {
                console.log(`[CHAT-SERVER]: Listening to new conversation (${conversation.id}) 👂🆕`);
                yield (0, botpress_1.addConversationListener)(conversation.id);
                yield (0, json_1.addConversationToActiveList)(conversation.id, {
                    botpressUserId: botpressUser.id,
                });
                console.log('[CHAT-SERVER]: Started listening to conversation and added it to active list ✅');
                // could add a timeout here
            }
        }
        catch (error) {
            console.log('[CHAT-SERVER]: Error when processing message created ❌', error);
        }
    });
}
exports.handleMessageCreated = handleMessageCreated;
function handleMessageUpdated(newMessage, oldMessage) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!(0, functions_1.checkMessageRestrictions)(newMessage)) {
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
            // 1. creates a conversation
            const conversation = yield (0, botpress_1.getOrCreateConversation)(adminChatKey, parsedInteraction.channelId);
            if (!conversation) {
                console.log('[CHAT-SERVER]: Error finding or creating conversation in Botpress ❌');
                return;
            }
            const conversationPayload = {
                type: 'thread',
                threadId: parsedInteraction.channelId, // added
            };
            const messagePayload = {
                content: 'ACTION_Ignore_Conversation',
                ignoringReason: 'The user has edited messages',
            };
            // REQ02
            // 2. sends the payload to ignore to botpress
            console.log('[CHAT-SERVER]: Sending payload to Botpress ✉️');
            yield (0, botpress_1.sendMessageToBotpress)(parsedInteraction.author.id, conversation.id, conversationPayload, messagePayload);
            // 4. removes the conversation from the listeners
            if (yield (0, json_1.removeConversationFromListeningList)(conversation.id)) {
                console.log(`[CHAT-SERVER]: Interaction for conversation ${conversation.id} has been removed due to message edit 📝`);
            }
            else {
                console.log(`[CHAT-SERVER]: Interaction for conversation ${conversation.id} could not be removed due to message edit ❌`);
            }
        }
        catch (error) {
            console.log('[CHAT-SERVER]: Error while processing message updated ❌', error);
        }
    });
}
exports.handleMessageUpdated = handleMessageUpdated;
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
exports.parseDiscordInteraction = parseDiscordInteraction;
