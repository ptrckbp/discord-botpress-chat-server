import express, { Request, Response } from 'express';

const startHealthCheckBeacon = () => {
	const app = express();

	app.get('/', function (req: Request, res: Response) {
		res.send('Server is up!');
		console.log('Health check beacon pinged!');
	});

	app.listen(process.env.PORT || 3000);
	console.log('[CHAT-SERVER]: Server is listening ✨');
};

export { startHealthCheckBeacon };
