import jwt from 'jsonwebtoken';
import { checkMessageRestrictions } from '../utils/functions';
import { config } from 'dotenv';
import {
	ConversationPayload,
	MessageFromDiscord,
	MessagePayload,
	ParsedDiscordInteraction,
	UserPayload,
} from '../utils/types';
import {
	Client as DiscordClient,
	GatewayIntentBits,
	Message,
	User,
} from 'discord.js';
import {
	botpressChatClient,
	getOrCreateConversation,
	getOrCreateUser,
	sendMessageToBotpress,
} from './botpress';


// set of conversations that are being listened to
const listeningToConversationsSet = new Set<string>([]);
const interactionMap = new Map<string, MessageFromDiscord>();

config();

const discordClient = new DiscordClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
});

// login to discord with your bot token
discordClient.login(process.env.DISCORD_APP_BOT_TOKEN);

export { discordClient };

export async function handleMessageCreated(interaction: Message) {
	try {
		if (!checkMessageRestrictions(interaction)) {
			return;
		}

		const parsedInteraction: ParsedDiscordInteraction | null =
			parseDiscordInteraction(interaction);

		if (!parsedInteraction) {
			console.log('[CHAT-SERVER]: Could not get parsed interaction ❌');
			return;
		}

		if (!parsedInteraction.author || !parsedInteraction.author.id) {
			console.log(
				'[CHAT-SERVER]: Author data not found in interaction ❌'
			);
			return;
		}

		const xChatKey = jwt.sign(
			{ fid: parsedInteraction.author?.id },
			process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || ''
		);

		// 1. gets or creates a user in botpress
		const botpressUser = await getOrCreateUser(
			xChatKey,
			parsedInteraction.author.id
		);

		if (!botpressUser) {
			console.log(
				'[CHAT-SERVER]: Error finding or creating user in Botpress ❌'
			);
			return;
		}

		// 2. creates a conversation
		const conversation = await getOrCreateConversation(
			xChatKey,
			parsedInteraction.channelId
		);

		if (!conversation) {
			console.log(
				'[CHAT-SERVER]: Error finding or creating conversation in Botpress ❌'
			);
			return;
		}

		const messagePayload: MessagePayload = {};

		// REQ03
		// check if there is an attachment that's not a link preview
		if (interaction.attachments.size > 0) {
			console.log('Ignoring message with attachments');
			messagePayload.action = 'ignore_conversation';
		} else {
			messagePayload.content = parsedInteraction.content;
		}

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

		// 3. sends the message to botpress
		console.log('[CHAT-SERVER]: Sending message to Botpress ✉️');
		await sendMessageToBotpress(
			xChatKey,
			conversation.id,
			conversationPayload,
			messagePayload,
			userPayload
		);

		if (!listeningToConversationsSet.has(conversation.id)) {
			console.log(
				`[CHAT-SERVER]: Listening to new conversation (${conversation.id}) 👂🆕`
			);
			listeningToConversationsSet.add(conversation.id);
			interactionMap.set(conversation.id, interaction);

			// could add a timeout here
		} else {
			console.log(
				`[CHAT-SERVER]: Already listening to this conversation (${conversation.id}) 👂✅`
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
			console.log('[CHAT-SERVER]: Received message from Botpress 💬');

			try {
				const typedEvent = event as typeof event & {
					payload: { text: string };
				};

				const conversationInteraction = interactionMap.get(
					conversation.id
				);

				if (!conversationInteraction) {
					console.log(
						'[CHAT-SERVER]: Interaction not found or has expired ⌛❌'
					);
					return;
				}

				if (typedEvent.userId === botpressUser.id) {
					console.log(
						'[CHAT-SERVER]: Ignoring message just sent by the current user 👤❌'
					);
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
						"[CHAT-SERVER]: Can't send message to Discord, payload is empty or not a string ❌"
					);
				}
			} catch (error) {
				console.log(
					'[CHAT-SERVER]: Error sending message to Discord ❌',
					error
				);
			}
		});
	} catch (error) {
		console.log(
			'[CHAT-SERVER]: Error when processing message created ❌',
			error
		);
	}
}

export async function handleMessageUpdated(
	newMessage: MessageFromDiscord,
	oldMessage: MessageFromDiscord
) {
	try {
		if (!checkMessageRestrictions(newMessage)) {
			return;
		}

		const parsedInteraction: ParsedDiscordInteraction | null =
			parseDiscordInteraction(oldMessage);

		if (!parsedInteraction) {
			console.log('[CHAT-SERVER]: Could not get parsed interaction ❌');
			return;
		}

		if (!parsedInteraction.author || !parsedInteraction.author.id) {
			console.log(
				'[CHAT-SERVER]: Author data not found in interaction ❌'
			);
			return;
		}

		const xChatKey = jwt.sign(
			{ fid: parsedInteraction.author.id },
			process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || ''
		);

		// 1. creates a conversation
		const conversation = await getOrCreateConversation(
			xChatKey,
			parsedInteraction.channelId
		);

		if (!conversation) {
			console.log(
				'[CHAT-SERVER]: Error finding or creating conversation in Botpress ❌'
			);
			return;
		}

		const conversationPayload: Partial<ConversationPayload> = {
			type: 'thread',
			threadId: parsedInteraction.channelId, // added
		};

		const messagePayload: MessagePayload = {
			action: 'ignore_conversation',
		};

		// REQ02
		// 2. sends the payload to ignore to botpress
		console.log('[CHAT-SERVER]: Sending payload to Botpress ✉️');

		await sendMessageToBotpress(
			xChatKey,
			conversation.id,
			conversationPayload,
			messagePayload
		);

		// 4. removes the conversation from the listeners
		listeningToConversationsSet.delete(conversation.id);
		interactionMap.delete(conversation.id);
		console.log(
			`[CHAT-SERVER]: Interaction for conversation ${conversation.id} has been removed due to message edit 📝`
		);
	} catch (error: any) {
		console.log(
			'[CHAT-SERVER]: Error while processing message updated ❌',
			error
		);
	}
}

export function parseDiscordInteraction(
	interactionRaw: MessageFromDiscord
): ParsedDiscordInteraction | null {
	try {
		const clonedInteraction = interactionRaw as typeof interactionRaw & {
			channel: { parent: { name: string } | null; name: string };
		};

		const authorData = clonedInteraction.author?.toJSON() as User | null;

		const parsed = {
			content: clonedInteraction.cleanContent || '',
			author: authorData,
			guildRoles:
				clonedInteraction.member?.roles.cache
					.map((a) => `[${a.name}]`)
					.join(' ') || '',
			parentChannelName: clonedInteraction.channel.parent?.name || '',
			channelName: clonedInteraction.channel.name,
			channelId: clonedInteraction.channelId,
			url: clonedInteraction.url,
		};

		return parsed;
	} catch (error) {
		console.log('[CHAT-SERVER]: Error parsing interaction ❌', error);

		return null;
	}
}
