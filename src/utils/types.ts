import {
	Attachment,
	Message as DiscordMessage,
	User as DiscordUser,
	PartialMessage as PartialDiscordMessage,
} from 'discord.js';

export interface ConversationPayload {
	type: string;
	parentName: string;
	threadName: string;
	threadId: string;
	url: string;
}

export interface MessagePayload {
	content?: string;
	ignoringReason?: string;
}

export interface UserPayload {
	guildRoles: string;
	nickname: string;
	name: string | null;
	authorId: string;
	botpressUserId?: string;
}

export type MessageFromDiscord =
	| DiscordMessage<boolean>
	| PartialDiscordMessage;

export interface ParsedDiscordInteraction {
	content: string;
	author: DiscordUser | null;
	guildRoles: string;
	parentChannelName: string;
	channelName: string;
	channelId: string;
	url: string;
	attachments: Attachment[];
}

export interface ConversationData {
	botpressUserId: string;
}

export interface ActiveConversations {
	[conversationId: string]: ConversationData;
}
