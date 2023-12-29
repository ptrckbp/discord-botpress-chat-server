import { config } from 'dotenv';
import { Events } from 'discord.js';
import { startHealthCheckBeacon } from './healthcheck';
import {
	discordClient,
	handleMessageCreated,
	handleMessageUpdated,
} from './services/discord';


config();

function initializeListeners() {
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
