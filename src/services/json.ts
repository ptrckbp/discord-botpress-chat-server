import * as fs from 'fs';

export function writeJsonContent(path: string, content: any) {
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

export function getJsonContent(path: string): Promise<any> {
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

export function updateJsonProperty(
	path: string,
	property: string,
	newValue: any
) {
	return new Promise<void>((resolve, reject) => {
		fs.readFile(path, 'utf8', async (error, data) => {
			if (error) {
				reject(error);
				return;
			}

			const json = JSON.parse(data);
			json[property] = newValue;

			await writeJsonContent(path, json);
		});
	});
}
