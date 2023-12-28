import { Client as BotpressChatClient } from '@botpress/chat';
import { config } from 'dotenv';

config();

const myWebhookId = process.env.BOTPRESS_CHAT_WEBHOOK_ID;

const botpressChatClient = new BotpressChatClient({
	apiUrl: `https://chat.botpress.cloud/${myWebhookId}`,
});

export { botpressChatClient };
