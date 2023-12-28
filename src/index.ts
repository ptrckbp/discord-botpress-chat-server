import jwt from 'jsonwebtoken';
import { botpressChatClient } from './services/botpress';
import { config } from 'dotenv';
import { discordClient } from './services/discord';
import { startHealthCheckBeacon } from './healthcheck';
import {
	Message as DiscordMessage,
	User as DiscordUser,
	Events,
	PartialMessage as PartialDiscordMessage,
} from 'discord.js';

config();

interface ConversationPayload {
	type: string;
	parentName: string;
	threadName: string;
	threadId: string;
	url: string;
}

interface MessagePayload {
	action?: string;
	content?: string;
}

interface UserPayload {
	guildRoles: string;
	nickname: string;
	name: string | null;
	authorId: string;
}

type MessageFromDiscord = DiscordMessage<boolean> | PartialDiscordMessage;

// set of conversations that are being listened to
const listeningToConversationsSet = new Set<string>([]);
const interactionMap = new Map<string, MessageFromDiscord>();

// gets or creates a user in botpress
async function getOrCreateUser(xChatKey: string, authorFid: string) {
	try {
		const existingUser = await botpressChatClient.getUser({ xChatKey });
		return existingUser.user;
	} catch (error) {
		const newlyCreatedUser = await botpressChatClient.createUser({
			// xChatKey,
			fid: authorFid,
		});
		return newlyCreatedUser.user;
	}
}

function checkMessageRestrictions(message: MessageFromDiscord): boolean {
	if (message.guildId != process.env.DISCORD_SERVER_ID) {
		console.log('Ignoring message from other server');
		return false;
	}

	if (message.system) {
		console.log('Ignoring system message');
		return false;
	}

	if (message.author?.bot) {
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

interface ParsedDiscordInteraction {
	content: string;
	author: DiscordUser | null;
	guildRoles: string;
	parentChannelName: string;
	channelName: string;
	channelId: string;
	url: string;
}

// listen to new messages from discord
discordClient.on(Events.MessageCreate, async (interaction) => {
	console.log("There's a new user message!:", interaction.cleanContent);

	if (!checkMessageRestrictions(interaction)) {
		return;
	}

	const parsedInteraction: ParsedDiscordInteraction =
		parseDiscordInteraction(interaction);

	if (!parsedInteraction.author) {
		console.log('Author data not found in interaction');
		return;
	}

	const xChatKey = jwt.sign(
		{ fid: parsedInteraction.author.id },
		process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || ''
	);

	// 1. gets or creates a user in botpress
	const botpressUser = await getOrCreateUser(
		xChatKey,
		parsedInteraction.author.id
	);

	// 2. creates a conversation
	const { conversation } = await botpressChatClient.getOrCreateConversation({
		xChatKey,
		fid: parsedInteraction.channelId,
	});

	const messagePayload: MessagePayload = {};

	// REQ03
	// check if there is an attachment that's not a link preview
	if (interaction.attachments.size > 0) {
		console.log('Ignoring message with attachments');
		messagePayload.action = 'ignore_conversation';
	} else {
		messagePayload.content = parsedInteraction.content;
	}

	// 3. sends the message to botpress
	console.log('Sending message to Botpress...');

	const conversationPayload: ConversationPayload = {
		type: 'thread',
		parentName: parsedInteraction.parentChannelName,
		threadName: parsedInteraction.channelName,
		threadId: parsedInteraction.channelId, // added
		url: parsedInteraction.url,
	};

	const userPayload: UserPayload = {
		guildRoles: parsedInteraction.guildRoles,
		nickname: parsedInteraction.author.username,
		name: parsedInteraction.author.globalName,
		authorId: parsedInteraction.author.id, // added
	};

	await sendMessageToBotpress(
		xChatKey,
		conversation.id,
		conversationPayload,
		messagePayload,
		userPayload
	);

	if (!listeningToConversationsSet.has(conversation.id)) {
		console.log(`Listening to new conversation (${conversation.id})...`);
		listeningToConversationsSet.add(conversation.id);
		interactionMap.set(conversation.id, interaction);

		// could add a timeout here
	} else {
		console.log(
			`Already listening to this conversation (${conversation.id})...`
		);
		return;
	}

	// 4. listens to messages from botpress
	const chatListener = await botpressChatClient.listenConversation({
		id: conversation.id,
		xChatKey,
	});

	// 5. sends messages from botpress to discord
	chatListener.on('message_created', async (event) => {
		console.log('Received message from Botpress...');
		console.log('event', event);

		const typedEvent = event as typeof event & {
			payload: { text: string };
		};

		const conversationInteraction = interactionMap.get(conversation.id);

		if (!conversationInteraction) {
			console.log('Interaction not found or has expired...');
			return;
		}

		if (typedEvent.userId === botpressUser.id) {
			console.log('Ignoring message just sent by the current user...');
			return;
		}

		if (
			typedEvent.payload.text ||
			typeof typedEvent.payload.text === 'string'
		) {
			conversationInteraction.reply(
				typedEvent.payload.text.slice(0, 2000)
			);
		} else {
			console.log(
				"Can't send message to discord, payload is empty or not a string..."
			);
		}
	});
});

// send payload to botpress to ignore conversation when message is edited
discordClient.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
	console.log('A message was updated!');

	if (!checkMessageRestrictions(newMessage)) {
		return;
	}

	const parsedInteraction: ParsedDiscordInteraction =
		parseDiscordInteraction(oldMessage);

	const xChatKey = jwt.sign(
		{ fid: parsedInteraction.author?.id },
		process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || ''
	);

	// 1. creates a conversation
	const { conversation } = await botpressChatClient.getOrCreateConversation({
		xChatKey,
		fid: parsedInteraction.channelId,
	});

	// REQ02
	// 2. sends the payload to ignore to botpress
	console.log(
		'Sending message instructions to ignore conversation to Botpress...'
	);
	await botpressChatClient.createMessage({
		xChatKey,
		conversationId: conversation.id,
		payload: {
			type: 'custom',
			payload: {
				conversation: {
					type: 'thread',
					threadId: parsedInteraction.channelId, // added
				} as ConversationPayload,
				message: {
					action: 'ignore_conversation',
				},
			},
		},
	});

	// 4. removes the conversation from the listeners
	listeningToConversationsSet.delete(conversation.id);
	interactionMap.delete(conversation.id);
	console.log(
		`Interaction for conversation ${conversation.id} has been removed due to message edit.`
	);
});

async function sendMessageToBotpress(
	xChatKey: string,
	conversationId: string,
	conversationPayload: ConversationPayload,
	messagePayload: MessagePayload,
	userPayload: UserPayload
) {
	return await botpressChatClient.createMessage({
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
}

function parseDiscordInteraction(
	interactionRaw: MessageFromDiscord
): ParsedDiscordInteraction {
	const clonedInteraction = interactionRaw as typeof interactionRaw & {
		channel: { parent: { name: string } | null; name: string };
	};

	const authorData = clonedInteraction.author?.toJSON() as DiscordUser | null;

	interface InteractionChannel {
		parent: { name: string };
		name: string;
		id: string;
	}

	const channelData =
		clonedInteraction.channel?.toJSON() as InteractionChannel;

	const parsed = {
		content: clonedInteraction.cleanContent || '',
		author: authorData,
		guildRoles:
			clonedInteraction.member?.roles.cache
				.map((a) => `[${a.name}]`)
				.join(' ') || '',
		parentChannelName: clonedInteraction.channel.parent?.name || '',
		channelName: clonedInteraction.channel.name,
		channelId: channelData.id,
		url: clonedInteraction.url,
	};

	return parsed;
}
