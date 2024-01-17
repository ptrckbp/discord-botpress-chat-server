import * as fs from 'fs';

import { ActiveConversations, ConversationData } from '../utils/types';

export async function writeJsonContent(path: string, content: any) {
	return new Promise<void>((resolve, reject) => {
		fs.writeFile(path, JSON.stringify(content), (error) => {
			if (error) {
				reject(error);
				return;
			}

			resolve();
		});
	});
}

export async function getJsonContent(path: string): Promise<any> {
	return new Promise((resolve, reject) => {
		fs.readFile(path, 'utf8', (error, data) => {
			if (error) {
				reject(error);
				return;
			}

			resolve(JSON.parse(data));
		});
	});
}

export async function getKeyValueFromJsonObject(
	path: string,
	key: string
): Promise<any> {
	return new Promise((resolve, reject) => {
		fs.readFile(path, 'utf8', (error, data) => {
			if (error) {
				reject(error);
				return;
			}

			const json = JSON.parse(data);
			const value = json[key];

			resolve(value);
		});
	});
}

export async function addKeyValueToJsonObject(
	path: string,
	key: string,
	value: any
) {
	return new Promise<void>((resolve, reject) => {
		fs.readFile(path, 'utf8', (error, data) => {
			if (error) {
				reject(error);
				return;
			}

			const json = JSON.parse(data);
			json[key] = value;

			writeJsonContent(path, json)
				.then(() => {
					resolve();
				})
				.catch((error) => {
					reject(error);
				});
		});
	});
}

export function isKeyInJsonObject(path: string, key: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		fs.readFile(path, 'utf8', (error, data) => {
			if (error) {
				reject(error);
				return;
			}

			const json = JSON.parse(data);
			const isKeyInJsonObject = key in json;

			resolve(isKeyInJsonObject);
		});
	});
}

// ------------------------------------------------------
// ------------------------------------------------------
// ------------------------------------------------------
// ------------------------------------------------------

export async function getActiveConversations(): Promise<ActiveConversations> {
	return await getJsonContent('./src/data/activeConversations.json');
}

export async function addConversationToActiveList(
	conversationId: string,
	conversationData: ConversationData
): Promise<void> {
	return await addKeyValueToJsonObject(
		'./src/data/activeConversations.json',
		conversationId,
		conversationData
	);
}

export async function isConversationBeingListened(
	conversationId: string
): Promise<boolean> {
	return await isKeyInJsonObject(
		'./src/data/activeConversations.json',
		conversationId
	);
}

export async function updateConversationData(
	conversationId: string,
	conversationData: ConversationData
): Promise<void> {
	return await addKeyValueToJsonObject(
		'./src/data/activeConversations.json',
		conversationId,
		conversationData
	);
}

export async function getConversationData(
	conversationId: string
): Promise<ConversationData> {
	return await getKeyValueFromJsonObject(
		'./src/data/activeConversations.json',
		conversationId
	);
}

export async function removeConversationFromListeningList(
	conversationId: string
): Promise<boolean> {
	return new Promise((resolve, reject) => {
		fs.readFile(
			'./src/data/activeConversations.json',
			'utf8',
			(error, data) => {
				if (error) {
					reject(error);
					return;
				}

				const json = JSON.parse(data);
				const isKeyInJsonObject = conversationId in json;

				if (!isKeyInJsonObject) {
					resolve(false);
					return;
				}

				delete json[conversationId];

				writeJsonContent('./src/data/activeConversations.json', json)
					.then(() => {
						resolve(true);
					})
					.catch((error) => {
						reject(error);
					});
			}
		);
	});
}
