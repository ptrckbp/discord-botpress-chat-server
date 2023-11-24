import 'dotenv/config';

import { Client, Events, GatewayIntentBits } from 'discord.js';

import { Client as BotpressClient } from '@botpress/chat';
import jwt from 'jsonwebtoken';
import { startHealthCheckBeacon } from './src/healthcheck.js';

const myWebhookId = process.env.BOTPRESS_CHAT_WEBHOOK_ID;

const botpressClient = new BotpressClient({
	apiUrl: `https://chat.botpress.cloud/${myWebhookId}`,
});

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
});

const listeningToConversationsSet = new Set([]);

const getOrCreateUser = async (xChatKey) => {
	try {
		const existingUser = await botpressClient.getUser({ xChatKey });
		return existingUser.user;
	} catch (error) {
		const newlyCreatedUser = await botpressClient.createUser({
			xChatKey,
			fid: authorFid,
		});
		return newlyCreatedUser.user;
	}
};

client.once(Events.ClientReady, startHealthCheckBeacon);

client.on(Events.MessageCreate, async (interaction) => {
	console.log("There's a new user message!");

	if (interaction.guildId != process.env.DISCORD_SERVER_ID) {
		return;
	}

	// ignore messages that are not in threads, remove this condition if you want to listen to all messages
	if (interaction.channel.type !== 11) {
		return;
	}

	// ignore bots
	if (interaction.author.bot) {
		return;
	}

	const clonedInteraction = JSON.parse(JSON.stringify(interaction));
	clonedInteraction.author = interaction.author.toJSON();
	clonedInteraction.userRoles = interaction.member?.roles.cache.map(
		(a) => a.name
	);
	clonedInteraction.parentChannelName = interaction.channel.parent?.name;
	clonedInteraction.channelName = interaction.channel.name;
	// clonedInteraction.channelType = interaction.channel.type;
	// clonedInteraction.parentChannelType = interaction.channel.parent?.type;

	// send to Botpress, wait for response, send response.

	const authorFid = clonedInteraction.authorId.toString();
	const xChatKey = jwt.sign(
		{ fid: authorFid },
		process.env.BOTPRESS_CHAT_ENCRYPTION_KEY
	);

	const user = await getOrCreateUser(xChatKey);

	// 1. create a conversation
	const { conversation } = await botpressClient.getOrCreateConversation({
		xChatKey,
		fid: clonedInteraction.channelId,
	});

	// 2. send the message to botpress
	await botpressClient.createMessage({
		xChatKey,
		conversationId: conversation.id,
		payload: {
			type: 'custom',
			payload: clonedInteraction,
		},
	});

	if (listeningToConversationsSet.has(conversation.id)) {
		return;
	}
	listeningToConversationsSet.add(conversation.id);

	const listener = await botpressClient.listenConversation({
		id: conversation.id,
		xChatKey,
	});

	listener.on('message_created', async (ev) => {
		if (ev.userId === user.id) {
			// message created by my current user, ignoring...
			return;
		}
		interaction.reply(ev.payload.text.slice(0, 2000));
	});
});

client.login(process.env.DISCORD_BOT_TOKEN);
