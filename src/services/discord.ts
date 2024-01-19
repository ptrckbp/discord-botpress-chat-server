import jwt from 'jsonwebtoken';
import { checkMessageRestrictions } from '../utils/functions';
import { config } from 'dotenv';
import {
	Attachment,
	Client as DiscordClient,
	User as DiscordUser,
	GatewayIntentBits,
	Message,
} from 'discord.js';
import {
	ConversationPayload,
	MessageFromDiscord,
	MessagePayload,
	ParsedDiscordInteraction,
	UserPayload,
} from '../utils/types';
import {
	addConversationListener,
	botpressChatClient,
	getConversationParticipants,
	getOrCreateConversation,
	getOrCreateUser,
	sendMessageToBotpress,
} from './botpress';
import {
	addConversationToActiveList,
	isConversationBeingListened,
	removeConversationFromListeningList,
	updateConversationData,
} from './json';

import { Conversation } from '@botpress/chat';

export function generateChatKey(fid: string): string {
	return jwt.sign({ fid }, process.env.BOTPRESS_CHAT_ENCRYPTION_KEY || '');
}

config();

const adminChatKey = generateChatKey(process.env.BOTPRESS_ADMIN_CHAT_FID || '');

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

		// console.log('[CHAT-SERVER]: Parsed interaction', parsedInteraction);

		// console.log('[CHAT-SERVER]: Parsed interaction', parsedInteraction);
		if (!parsedInteraction.author || !parsedInteraction.author.id) {
			console.log(
				'[CHAT-SERVER]: Author data not found in interaction ❌'
			);
			return;
		}

		const userChatKey = generateChatKey(parsedInteraction.author.id);

		let conversation: Conversation | null = null;

		// 1. gets or creates a conversation
		const conversationAdminKey = await getOrCreateConversation(
			parsedInteraction.channelId
		);

		if (conversationAdminKey) {
			console.log(
				'[CHAT-SERVER]: Retrieved the conversation data in Botpress with admin key 🔎'
			);

			conversation = conversationAdminKey;
		} else {
			console.log(
				'[CHAT-SERVER]: Could not retrieve the Botpress conversation with admin key ❌'
			);

			const conversationUserKey = await getOrCreateConversation(
				parsedInteraction.channelId,
				userChatKey
			);

			if (conversationUserKey) {
				console.log(
					'[CHAT-SERVER]: Retrieved the conversation data in Botpress with user key 🔎'
				);

				conversation = conversationUserKey;
			} else {
				console.log(
					'[CHAT-SERVER]: Could not retrieve the Botpress conversation with user key ❌'
				);

				const allConversations =
					await botpressChatClient.listConversations({
						xChatKey: adminChatKey,
					});

				const thisConversation = allConversations.conversations.find(
					(c) => c.fid === parsedInteraction.channelId
				);

				if (thisConversation) {
					const participants = await getConversationParticipants(
						userChatKey,
						thisConversation.id
					);

					if (!participants) {
						console.log(
							'[CHAT-SERVER]: Could not retrieve the Botpress conversation participants using current user key ❌'
						);
						return;
					}

					const conversationFirstParticipantKey = generateChatKey(
						participants.sort(
							(a, b) =>
								new Date(a.createdAt).getTime() -
								new Date(b.createdAt).getTime()
						)[0].fid || ''
					);

					const conversationFirstParticipant =
						await getOrCreateConversation(
							parsedInteraction.channelId,
							conversationFirstParticipantKey
						);

					if (conversationFirstParticipant) {
						console.log(
							'[CHAT-SERVER]: Retrieved the conversation data in Botpress with first participant key 🔎'
						);

						conversation = conversationFirstParticipant;
					} else {
						console.log(
							'[CHAT-SERVER]: Could not retrieve the Botpress conversation with first participant key ❌'
						);

						return;
					}
				} else {
					console.log(
						'[CHAT-SERVER]: Could not retrieve the Botpress conversation using admin key ❌'
					);
				}
			}
		}

		if (!conversation) {
			console.log(
				'[CHAT-SERVER]: Could not retrieve the Botpress conversation ❌'
			);

			return;
		}

		// 2. gets or creates a user in botpress
		const botpressUser = await getOrCreateUser(
			userChatKey,
			parsedInteraction.author.id
		);

		if (!botpressUser) {
			console.log('[CHAT-SERVER]: Could not retrieve Botpress user ❌');
			return;
		}

		const participants = await getConversationParticipants(
			userChatKey,
			conversation.id
		);

		if (!participants?.length) {
			console.log(
				'[CHAT-SERVER]: Could not retrieve the Botpress conversation participants with admin or current user key ❌'
			);
			return;
		}

		// every new user
		console.log(
			'[CHAT-SERVER]: Looking for user among conversation participants 🔎'
		);
		if (
			!participants.find(
				(participant) => participant.id === botpressUser.id
			)
		) {
			console.log(
				"[CHAT-SERVER]: User wasn't found among conversation participants, adding them... ⏳"
			);

			await botpressChatClient.addParticipant({
				id: conversation.id,
				xChatKey: adminChatKey,
				userId: botpressUser.id,
			});

			console.log(
				'[CHAT-SERVER]: User added to list of conversation participants ✅'
			);
		}

		const messagePayload: MessagePayload = {};

		// REQ03, REQ13
		// check if there is an attachment that's not a link preview
		if (parsedInteraction.attachments.length > 0) {
			console.log('[CHAT-SERVER]: Ignoring message with attachments ❌');

			console.log(
				'[CHAT-SERVER]: Sending payload to ignore conversation ✉️'
			);

			messagePayload.content = 'ACTION_Ignore_Conversation';
			messagePayload.ignoringReason = 'The user has sent attachments';
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
			authorId: parsedInteraction.author.id,
			botpressUserId: botpressUser.id, // added
		};

		// 3. sends the message to botpress
		console.log('[CHAT-SERVER]: Sending message to Botpress ✉️');
		await sendMessageToBotpress({
			discordUserId: parsedInteraction.author.id,
			conversationId: conversation.id,
			conversationPayload,
			messagePayload,
			userPayload,
		});

		// if (messagePayload.content === 'ACTION_Ignore_Conversation') {
		// 	console.log(
		// 		'[CHAT-SERVER]: Not adding conversation to listeners because it will be ignored 👂❌'
		// 	);

		// 	return;
		// }

		// REQ15
		if (await isConversationBeingListened(conversation.id)) {
			console.log(
				`[CHAT-SERVER]: Already listening to this conversation 👂✅ `
			);

			await updateConversationData(conversation.id, {
				botpressUserId: botpressUser.id,
			});

			console.log(
				'[CHAT-SERVER]: Updated conversation with the id of the last user that interacted ✅'
			);

			return;
		} else {
			console.log(
				`[CHAT-SERVER]: Listening to new conversation (${conversation.id}) 👂🆕`
			);

			await addConversationListener(conversation.id);
			await addConversationToActiveList(conversation.id, {
				botpressUserId: botpressUser.id,
			});

			console.log(
				'[CHAT-SERVER]: Started listening to conversation and added it to active list ✅'
			);
			// could add a timeout here
		}
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

		// 1. creates a conversation
		const conversation = await getOrCreateConversation(
			parsedInteraction.channelId
		);

		if (!conversation) {
			console.log(
				'[CHAT-SERVER]: Error finding or creating conversation in Botpress ❌'
			);
			return;
		}

		const botpressUser = await getOrCreateUser(
			generateChatKey(parsedInteraction.author.id),
			parsedInteraction.author.id
		);

		if (!botpressUser) {
			console.log('[CHAT-SERVER]: Could not retrieve Botpress user ❌');
			return;
		}

		const conversationPayload: Partial<ConversationPayload> = {
			type: 'thread',
			threadId: parsedInteraction.channelId, // added
		};

		const messagePayload: MessagePayload = {
			content: 'ACTION_Ignore_Conversation',
			ignoringReason: 'The user has edited messages',
		};

		const userPayload: UserPayload = {
			guildRoles: parsedInteraction.guildRoles,
			nickname: parsedInteraction.author.username,
			name: parsedInteraction.author.globalName,
			authorId: parsedInteraction.author.id, // added
			botpressUserId: botpressUser.id,
		};

		// REQ02
		// 2. sends the payload to ignore to botpress
		console.log('[CHAT-SERVER]: Sending payload to Botpress ✉️');

		await sendMessageToBotpress({
			discordUserId: parsedInteraction.author.id,
			conversationId: conversation.id,
			conversationPayload,
			messagePayload,
			userPayload,
		});

		// 4. removes the conversation from the listeners
		if (await removeConversationFromListeningList(conversation.id)) {
			console.log(
				`[CHAT-SERVER]: Interaction for conversation ${conversation.id} has been removed due to message edit 📝`
			);
		} else {
			console.log(
				`[CHAT-SERVER]: Interaction for conversation ${conversation.id} could not be removed due to message edit ❌`
			);
		}
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

		const authorData =
			clonedInteraction.author?.toJSON() as DiscordUser | null;

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
			attachments:
				(clonedInteraction.attachments?.toJSON() as Attachment[]) || [],
		};

		return parsed;
	} catch (error) {
		console.log('[CHAT-SERVER]: Error parsing interaction ❌', error);

		return null;
	}
}
