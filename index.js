import 'dotenv/config';

import { Client as DiscordClient, Events, GatewayIntentBits } from 'discord.js';

import { Client as BotpressClient } from '@botpress/chat';
import jwt from 'jsonwebtoken';
import { startHealthCheckBeacon } from './src/healthcheck.js';

const myWebhookId = process.env.BOTPRESS_CHAT_WEBHOOK_ID;

// create a botpress client
const botpressClient = new BotpressClient({
	apiUrl: `https://chat.botpress.cloud/${myWebhookId}`,
});

// create a discord client
const client = new DiscordClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
});

// login to discord with your bot token
client.login(process.env.DISCORD_BOT_TOKEN);

// set of conversations that are being listened to
const listeningToConversationsSet = new Set([]);

// gets or creates a user in botpress
async function getOrCreateUser(xChatKey, authorFid) {
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
}

// start the health check beacon
client.once(Events.ClientReady, startHealthCheckBeacon);

// listen to new messages from discord
client.on(Events.MessageCreate, async (interaction) => {
	console.log("There's a new user message!");

	// ignore messages that are not in the server
	if (interaction.guildId != process.env.DISCORD_SERVER_ID) {
		console.log('Ignoring message from other server');
		return;
	}

	// ignore messages that are not in threads
	// remove this condition if you want to listen to all messages
	if (interaction.channel.type !== 11) {
		console.log('Ignoring message from non-thread channel');
		return;
	}

	// ignore messages from bots
	if (interaction.author.bot) {
		console.log('Ignoring message from bot');
		return;
	}

	const clonedInteraction = JSON.parse(JSON.stringify(interaction));

	const content = interaction.cleanContent;
	const authorFid = clonedInteraction.authorId.toString();
	const guildRoles = interaction.member?.roles.cache
		.map((a) => `[${a.name}]`)
		.join(' ');
	const parentChannelName = interaction.channel.parent?.name;
	// const channelName = interaction.channel.name; not used since this is a thread and we care about the parent channel
	const channelId = interaction.channelId;
	const url = interaction.url;

	const xChatKey = jwt.sign(
		{ fid: authorFid },
		process.env.BOTPRESS_CHAT_ENCRYPTION_KEY
	);

	// 1. gets or creates a user in botpress
	const botpressUser = await getOrCreateUser(xChatKey, authorFid);

	// 2. creates a conversation
	const { conversation } = await botpressClient.getOrCreateConversation({
		xChatKey,
		fid: channelId,
	});

	// 3. sends the message to botpress
	await botpressClient.createMessage({
		xChatKey,
		conversationId: conversation.id,
		payload: {
			type: 'custom',
			payload: {
				user: {
					guildRoles: guildRoles,
					nickname: author.username,
					name: author.globalName,
				},
				conversation: {
					type: 'thread',
					parentName: parentChannelName,
					url: url,
				},
				message: { content: content },
			},
		},
	});

	if (listeningToConversationsSet.has(conversation.id)) {
		return;
	}
	listeningToConversationsSet.add(conversation.id);

	// 4. listens to messages from botpress
	const listener = await botpressClient.listenConversation({
		id: conversation.id,
		xChatKey,
	});

	// 5. sends messages from botpress to discord
	listener.on('message_created', async (ev) => {
		if (ev.userId === botpressUser.id) {
			// message created by my current user, ignoring...
			return;
		}
		interaction.reply(ev.payload.text.slice(0, 2000));
	});
});
