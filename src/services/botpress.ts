import { Client as BotpressChatClient } from '@botpress/chat';
import { config } from 'dotenv';
import { generateChatKey } from './discord';
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

export {
	botpressChatClient,
	sendMessageToBotpress,
	getOrCreateUser,
	getOrCreateConversation,
};
