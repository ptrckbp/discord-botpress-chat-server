var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import jwt from 'jsonwebtoken';
import { botpressChatClient } from './services/botpress';
import { config } from 'dotenv';
import { discordClient } from './services/discord';
import { startHealthCheckBeacon } from './healthcheck';
import { Events, } from 'discord.js';
config();
// set of conversations that are being listened to
const listeningToConversationsSet = new Set([]);
const interactionMap = new Map();
// gets or creates a user in botpress
function getOrCreateUser(xChatKey, authorFid) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const existingUser = yield botpressChatClient.getUser({ xChatKey });
            return existingUser.user;
        }
        catch (error) {
            const newlyCreatedUser = yield botpressChatClient.createUser({
                // xChatKey,
                fid: authorFid,
            });
            return newlyCreatedUser.user;
        }
    });
}
function checkMessageRestrictions(message) {
    var _a;
    if (message.guildId != process.env.DISCORD_SERVER_ID) {
        console.log('Ignoring message from other server');
        return false;
    }
    if (message.system) {
        console.log('Ignoring system message');
        return false;
    }
    if ((_a = message.author) === null || _a === void 0 ? void 0 : _a.bot) {
        console.log('Ignoring message from bot');
        return false;
    }
    if (message.channel.type !== 11) {
        console.log('Ignoring message from non-thread channel');
        return false;
    }
    return true;
}
// checks if botpress is up and running
discordClient.once(Events.ClientReady, startHealthCheckBeacon);
// listen to new messages from discord
discordClient.on(Events.MessageCreate, (interaction) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("There's a new user message!:", interaction.cleanContent);
    if (!checkMessageRestrictions(interaction)) {
        return;
    }
    const clonedInteraction = JSON.parse(JSON.stringify(interaction));
    const parsedInteraction = parseDiscordInteraction(clonedInteraction);
    const xChatKey = jwt.sign({ fid: parsedInteraction.authorId }, process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || '');
    // 1. gets or creates a user in botpress
    const botpressUser = yield getOrCreateUser(xChatKey, parsedInteraction.authorId);
    // 2. creates a conversation
    const { conversation } = yield botpressChatClient.getOrCreateConversation({
        xChatKey,
        fid: parsedInteraction.channelId,
    });
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
    // 3. sends the message to botpress
    console.log('Sending message to Botpress...');
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
    yield sendMessageToBotpress(xChatKey, conversation.id, conversationPayload, messagePayload, userPayload);
    if (!listeningToConversationsSet.has(conversation.id)) {
        console.log(`Listening to new conversation (${conversation.id})...`);
        listeningToConversationsSet.add(conversation.id);
        interactionMap.set(conversation.id, interaction);
        // could add a timeout here
    }
    else {
        console.log(`Already listening to this conversation (${conversation.id})...`);
        return;
    }
    // 4. listens to messages from botpress
    const chatListener = yield botpressChatClient.listenConversation({
        id: conversation.id,
        xChatKey,
    });
    // 5. sends messages from botpress to discord
    chatListener.on('message_created', (event) => __awaiter(void 0, void 0, void 0, function* () {
        console.log('Received message from Botpress...');
        console.log('event', event);
        const typedEvent = event;
        const conversationInteraction = interactionMap.get(conversation.id);
        if (!conversationInteraction) {
            console.log('Interaction not found or has expired...');
            return;
        }
        if (typedEvent.userId === botpressUser.id) {
            console.log('Ignoring message just sent by the current user...');
            return;
        }
        if (typedEvent.payload.text ||
            typeof typedEvent.payload.text === 'string') {
            conversationInteraction.reply(typedEvent.payload.text.slice(0, 2000));
        }
        else {
            console.log("Can't send message to discord, payload is empty or not a string...");
        }
    }));
}));
// send payload to botpress to ignore conversation when message is edited
discordClient.on(Events.MessageUpdate, (oldMessage, newMessage) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('A message was updated!');
    if (!checkMessageRestrictions(newMessage)) {
        return;
    }
    const parsedInteraction = parseDiscordInteraction(oldMessage);
    const xChatKey = jwt.sign({ fid: parsedInteraction.authorId }, process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || '');
    // 1. creates a conversation
    const { conversation } = yield botpressChatClient.getOrCreateConversation({
        xChatKey,
        fid: parsedInteraction.channelId,
    });
    // REQ02
    // 2. sends the payload to ignore to botpress
    console.log('Sending message instructions to ignore conversation to Botpress...');
    yield botpressChatClient.createMessage({
        xChatKey,
        conversationId: conversation.id,
        payload: {
            type: 'custom',
            payload: {
                conversation: {
                    type: 'thread',
                    threadId: parsedInteraction.channelId, // added
                },
                message: {
                    action: 'ignore_conversation',
                },
            },
        },
    });
    // 4. removes the conversation from the listeners
    listeningToConversationsSet.delete(conversation.id);
    interactionMap.delete(conversation.id);
    console.log(`Interaction for conversation ${conversation.id} has been removed due to message edit.`);
}));
function sendMessageToBotpress(xChatKey, conversationId, conversationPayload, messagePayload, userPayload) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield botpressChatClient.createMessage({
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
    });
}
function parseDiscordInteraction(interactionD) {
    var _a, _b, _c;
    const interaction = JSON.parse(JSON.stringify(interactionD));
    return {
        content: interaction.cleanContent || '',
        author: (_a = interaction.author) === null || _a === void 0 ? void 0 : _a.toJSON(),
        authorId: interaction.authorId.toString(),
        guildRoles: ((_b = interaction.member) === null || _b === void 0 ? void 0 : _b.roles.cache.map((a) => `[${a.name}]`).join(' ')) || '',
        parentChannelName: ((_c = interaction.channel.parent) === null || _c === void 0 ? void 0 : _c.name) || '',
        channelName: interaction.channel.name,
        channelId: interaction.channelId,
        url: interaction.url,
    };
}
