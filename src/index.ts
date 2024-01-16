import { botpressChatClient } from './services/botpress';
import { config } from 'dotenv';
import { Events } from 'discord.js';
import { startHealthCheckBeacon } from './healthcheck';
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
	})();

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
