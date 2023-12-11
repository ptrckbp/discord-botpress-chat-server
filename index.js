import 'dotenv/config';

import { Client as DiscordClient, Events, GatewayIntentBits } from 'discord.js';

import { Client as BotpressClient } from '@botpress/chat';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { startHealthCheckBeacon } from './src/healthcheck.js';

// const INTERACTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

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
const interactionMap = new Map();

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

// checks if botpress is up and running
client.once(Events.ClientReady, startHealthCheckBeacon);

// listen to new messages from discord
client.on(Events.MessageCreate, async (interaction) => {
	console.log("There's a new user message!:", interaction.cleanContent);

	// check if there is an attachment that's not a link preview
	if (interaction.attachments.size > 0) {
		console.log('Ignoring message with attachments');
		// interaction.reply("I can't process messages with attachments");
		return;
	}

	// check out the interaction.example.json file to see what's inside the interaction object

	// ignore messages that are not in the server
	if (interaction.guildId != process.env.DISCORD_SERVER_ID) {
		console.log('Ignoring message from other server');
		return;
	}

	// ignore messages from system
	if (interaction.system) {
		console.log('Ignoring system message');
		return;
	}

	// ignore messages from bots
	if (interaction.author.bot) {
		console.log('Ignoring message from bot');
		return;
	}

	// ignore messages that are not in threads
	// remove this condition if you want to listen to all messages
	if (interaction.channel.type !== 11) {
		console.log('Ignoring message from non-thread channel');
		return;
	}

	const clonedInteraction = JSON.parse(JSON.stringify(interaction));

	const author = interaction.author.toJSON();
	const content = interaction.cleanContent;
	const authorFid = clonedInteraction.authorId.toString();
	const guildRoles = interaction.member?.roles.cache
		.map((a) => `[${a.name}]`)
		.join(' ');
	const parentChannelName = interaction.channel.parent?.name;
	const channelName = interaction.channel.name;
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
	console.log('Sending message to Botpress...');
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
					authorId: author.id, // added
				},
				conversation: {
					type: 'thread',
					parentName: parentChannelName,
					threadName: channelName,
					threadId: channelId, // added
					url: url,
				},
				message: { content: content },
			},
		},
	});

	if (!listeningToConversationsSet.has(conversation.id)) {
		console.log(`Listening to new conversation (${conversation.id})...`);
		listeningToConversationsSet.add(conversation.id);
		interactionMap.set(conversation.id, interaction);

		// Set a timeout to remove the interaction after the specified period
		// setTimeout(() => {
		// 	interactionMap.delete(conversation.id);
		// 	console.log(
		// 		`Interaction for conversation ${conversation.id} has been removed due to timeout.`
		// 	);
		// }, INTERACTION_TIMEOUT);
	} else {
		console.log(
			`Already listening to this conversation (${conversation.id})...`
		);
		return;
	}

	// 4. listens to messages from botpress
	const listener = await botpressClient.listenConversation({
		id: conversation.id,
		xChatKey,
	});

	// 5. sends messages from botpress to discord
	listener.on('message_created', async (ev) => {
		console.log('Received message from Botpress...');
		console.log('event', ev);

		const conversationInteraction = interactionMap.get(conversation.id);

		// Check if the interaction is still valid
		if (!conversationInteraction) {
			console.log('Interaction not found or has expired...');
			return;
		}

		// ignore messages just sent by the current user
		if (ev.userId === botpressUser.id) {
			console.log('Ignoring message from current user...');
			return;
		}

		if (ev.payload.text) {
			conversationInteraction.reply(ev.payload.text.slice(0, 2000));
		} else {
			console.log("Can't send message to discord, payload is empty...");
		}
	});
});

// send payload to botpress to ignore conversation when message is edited
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
	console.log('A message was updated!');

	// ignore messages that are not in the server
	if (oldMessage.guildId != process.env.DISCORD_SERVER_ID) {
		console.log('Ignoring message from other server');
		return;
	}

	// ignore messages from system
	if (oldMessage.system) {
		console.log('Ignoring system message');
		return;
	}

	// ignore messages from bots
	if (oldMessage.author.bot) {
		console.log('Ignoring message from bot');
		return;
	}

	// ignore messages that are not in threads
	// remove this condition if you want to listen to all messages
	if (oldMessage.channel.type !== 11) {
		console.log('Ignoring message from non-thread channel');
		return;
	}

	const clonedInteraction = JSON.parse(JSON.stringify(oldMessage));

	const authorFid = clonedInteraction.authorId.toString();
	const channelId = oldMessage.channelId;

	const xChatKey = jwt.sign(
		{ fid: authorFid },
		process.env.BOTPRESS_CHAT_ENCRYPTION_KEY
	);

	// 1. creates a conversation
	const { conversation } = await botpressClient.getOrCreateConversation({
		xChatKey,
		fid: channelId,
	});

	// 2. sends the payload to ignore to botpress
	console.log('Sent instructions to ignore to Botpress...');
	await axios.post(
		`https://webhook.botpress.cloud/${process.env.DISCORD_WEBHOOK_WEBHOOK_ID}/ignore-conversation`,
		{
			conversationId: conversation.id,
			reason: 'The user edited some messages',
		}
	);

	// 3. replies to the user
	// oldMessage.reply(
	// 	"I can't process edited messages. This thread has been closed, please create another one..."
	// );

	// 4. removes the conversation from the listeners
	listeningToConversationsSet.delete(conversation.id);
	interactionMap.delete(conversation.id);
	console.log(
		`Interaction for conversation ${conversation.id} has been removed due to message edit.`
	);
});
