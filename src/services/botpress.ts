import { Client as BotpressChatClient, User } from '@botpress/chat';
import { config } from 'dotenv';
import { discordClient, generateChatKey } from './discord';
import { getActiveConversations, getConversationData } from './json';
import { TextChannel } from 'discord.js';
import {
	Conversation as BotpressConversation,
	User as BotpressUser,
} from '@botpress/chat';
import {
	ConversationPayload,
	MessagePayload,
	UserPayload,
} from '../utils/types';

config();

const myWebhookId = process.env.BOTPRESS_CHAT_WEBHOOK_ID;

const botpressChatClient = new BotpressChatClient({
	apiUrl: `https://chat.botpress.cloud/${myWebhookId}`,
});

async function sendMessageToBotpress(
	discordUserId: string,
	conversationId: string,
	conversationPayload: ConversationPayload | Partial<ConversationPayload>,
	messagePayload: MessagePayload,
	userPayload?: UserPayload
): Promise<void> {
	try {
		await botpressChatClient.createMessage({
			xChatKey: generateChatKey(discordUserId),
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
	} catch (error) {
		console.error(
			'[CHAT-SERVER]: Error while sending message to Botpress ❌',
			error
		);
	}
}

// gets or creates a user in botpress
async function getOrCreateUser(
	xChatKey: string,
	authorFid: string
): Promise<BotpressUser | null> {
	try {
		const existingUser = await botpressChatClient.getUser({ xChatKey });

		console.log(
			"[CHAT-SERVER]: Found the existing user's data in Botpress 🔎"
		);

		return existingUser.user;
	} catch (error) {
		console.log(
			"[CHAT-SERVER]: Error finding the user's data in Botpress ❌",
			error
		);

		try {
			const newlyCreatedUser = await botpressChatClient.createUser({
				fid: authorFid,
			});

			console.log('[CHAT-SERVER]: Created a new user in Botpress ✅');

			return newlyCreatedUser.user;
		} catch (error) {
			console.log(
				'[CHAT-SERVER]: Error creating a new user in Botpress ❌',
				error
			);

			return null;
		}
	}
}

async function getOrCreateConversation(
	xChatKey: string,
	channelFid: string
): Promise<BotpressConversation | null> {
	try {
		const conversation = await botpressChatClient.getOrCreateConversation({
			xChatKey,
			fid: channelFid,
		});

		console.log(
			'[CHAT-SERVER]: Found or created the conversation data in Botpress 🔎'
		);

		return conversation.conversation;
	} catch (error) {
		console.log(
			'[CHAT-SERVER]: Error finding the conversation data in Botpress ❌',
			error
		);

		return null;
	}
}

export async function addConversationListener(
	conversationId: string
	// channelId: string
) {
	if (!conversationId) {
		console.log(
			'[CHAT-SERVER]:[BOTPRESS-LISTENER] ConversationId not provided ❌'
		);
		return;
	}

	const botpressConversation = await botpressChatClient.getConversation({
		id: conversationId,
		xChatKey: generateChatKey(process.env.BOTPRESS_ADMIN_CHAT_FID || ''),
	});

	if (!botpressConversation) {
		console.log(
			'[CHAT-SERVER]:[BOTPRESS-LISTENER] Conversation not found ❌'
		);
		return;
	}

	const channelId = botpressConversation.conversation?.fid;

	if (!channelId) {
		console.log(
			"[CHAT-SERVER]:[BOTPRESS-LISTENER] Couldn't find fid info in conversation ❌"
		);
		return;
	}

	const conversationChannel = (await discordClient.channels.fetch(
		channelId
	)) as TextChannel;

	if (!conversationChannel) {
		console.log('[CHAT-SERVER]:[BOTPRESS-LISTENER] Channel not found ❌');
		return;
	}

	const chatListener = await botpressChatClient.listenConversation({
		id: conversationId,
		xChatKey: generateChatKey(process.env.BOTPRESS_ADMIN_CHAT_FID || ''),
	});

	chatListener.on('message_created', async (event) => {
		const typedEvent = event as typeof event & {
			payload: { text: string };
		};

		if (!typedEvent.payload?.text) {
			return;
		}

		console.log(
			'[CHAT-SERVER]:[BOTPRESS-LISTENER] Received message from Botpress 💬'
		);

		try {
			if (!typedEvent.payload) {
				console.log(
					'[CHAT-SERVER]:[BOTPRESS-LISTENER] Payload not found ❌'
				);
				return;
			}

			const conversationData = await getConversationData(conversationId);

			if (!conversationData) {
				console.log(
					'[CHAT-SERVER]:[BOTPRESS-LISTENER] Interaction not found or has expired ⌛❌'
				);
				return;
			}

			if (typedEvent.userId === conversationData.botpressUserId) {
				console.log(
					'[CHAT-SERVER]:[BOTPRESS-LISTENER] Ignoring message just sent by the current user 👤❌'
				);
				return;
			}

			if (
				typedEvent.payload.text ||
				typeof typedEvent.payload.text === 'string'
			) {
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

				conversationChannel.send(
					typedEvent.payload.text.slice(0, 2000)
				);

				console.log(
					`[CHAT-SERVER]:[BOTPRESS-LISTENER] Sent message to Discord ✅`
				);
			} else {
				console.log(
					"[CHAT-SERVER]:[BOTPRESS-LISTENER] Can't send message to Discord, payload is empty or not a string ❌"
				);
			}
		} catch (error) {
			console.log(
				'[CHAT-SERVER]:[BOTPRESS-LISTENER] Error sending message to Discord ❌',
				error
			);
		}
	});
}

export async function getOrCreateAdminUser(): Promise<User | null> {
	try {
		const adminFid = process.env.BOTPRESS_ADMIN_CHAT_FID || '';

		const existingUser = await botpressChatClient.getUser({
			xChatKey: generateChatKey(adminFid),
		});

		if (existingUser) {
			console.log(
				'[CHAT-SERVER]: Admin user already exists in Botpress ✅'
			);

			return existingUser.user;
		} else {
			console.log(
				'[CHAT-SERVER]: Admin user does not exist in Botpress ❌'
			);

			const user = await botpressChatClient.createUser({
				fid: adminFid,
				name: 'Admin',
			});

			console.log('[CHAT-SERVER]: Admin user created in Botpress ✅');

			return user.user;
		}
	} catch (error) {
		console.log(
			'[CHAT-SERVER]: Error creating or retrieving admin user in Botpress ❌',
			error
		);

		return null;
	}
}

export async function restoreActiveConversationsListener() {
	try {
		console.log('[CHAT-SERVER]: Retrieving active conversations 🔎');
		const activeConversations = await getActiveConversations();

		console.log(
			`[CHAT-SERVER]: Found ${
				Object.keys(activeConversations).length
			} active conversations 🔎`
		);

		if (Object.keys(activeConversations).length) {
			console.log(
				'[CHAT-SERVER]: Adding listener for active conversations ✅'
			);

			for (const conversationId in activeConversations) {
				try {
					await addConversationListener(conversationId);

					console.log(
						`[CHAT-SERVER]: Started listening to conversation (${conversationId}) 👂🆕`
					);
				} catch (error) {
					console.log(
						`[CHAT-SERVER]: Error listening to conversation (${conversationId}) ❌`,
						error
					);
				}
			}
		}
	} catch (error) {
		console.log(
			'[CHAT-SERVER]: Error retrieving active conversations from database ❌',
			error
		);
	}
}

export {
	botpressChatClient,
	sendMessageToBotpress,
	getOrCreateUser,
	getOrCreateConversation,
};
