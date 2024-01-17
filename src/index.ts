import { config } from 'dotenv';
import { Events } from 'discord.js';
import { getActiveConversations } from './services/json';
import { startHealthCheckBeacon } from './healthcheck';
import {
	addConversationListener,
	botpressChatClient,
} from './services/botpress';
import {
	discordClient,
	generateChatKey,
	handleMessageCreated,
	handleMessageUpdated,
} from './services/discord';

config();

function initializeListeners() {
	const adminFid = process.env.BOTPRESS_ADMIN_CHAT_FID || '';

	// create admin user in botpress
	(async () => {
		try {
			if (
				await botpressChatClient.getUser({
					xChatKey: generateChatKey(adminFid),
				})
			) {
				console.log(
					'[CHAT-SERVER]: Admin user already exists in Botpress ✅'
				);
			} else {
				console.log(
					'[CHAT-SERVER]: Admin user does not exist in Botpress ❌'
				);

				await botpressChatClient.createUser({
					fid: adminFid,
					name: 'Admin',
				});

				console.log('[CHAT-SERVER]: Admin user created in Botpress ✅');
			}
		} catch (error) {
			console.log(
				'[CHAT-SERVER]: Error creating or retrieving admin user in Botpress ❌',
				error
			);
		}

		// start listening to all conversations stored
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
	})();

	discordClient.on('ready', () => {
		console.log('[CHAT-SERVER]: Discord client is ready ✅');
	});

	// checks if botpress is up and running
	discordClient.once(Events.ClientReady, startHealthCheckBeacon);

	// listen to new messages from discord
	discordClient.on(Events.MessageCreate, async (interaction) => {
		console.log(
			`[CHAT-SERVER]: There's a new user message! 🆕 : "${interaction.cleanContent}"`
		);

		handleMessageCreated(interaction);
	});

	// send payload to botpress to ignore conversation when message is edited
	discordClient.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
		console.log(
			`[CHAT-SERVER]: A message was updated! 📝 : "${oldMessage.cleanContent}" => "${newMessage.cleanContent}"`
		);

		handleMessageUpdated(oldMessage, newMessage);
	});
}

initializeListeners();
