import { MessageFromDiscord } from './types';

function checkMessageRestrictions(message: MessageFromDiscord): boolean {
	if (message.guildId != process.env.DISCORD_SERVER_ID) {
		console.log('[CHAT-SERVER]: Ignoring message from other server ⛔');
		return false;
	}

	if (message.system) {
		console.log('[CHAT-SERVER]: Ignoring system message ⛔');
		return false;
	}

	if (message.author?.bot) {
		console.log('[CHAT-SERVER]: Ignoring message from bot ⛔');
		return false;
	}

	if (message.channel?.type !== 11) {
		console.log(
			'[CHAT-SERVER]: Ignoring message from non-thread channel ⛔'
		);
		return false;
	}

	return true;
}

export { checkMessageRestrictions };
