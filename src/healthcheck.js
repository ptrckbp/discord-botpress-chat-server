import express from 'express';

const startHealthCheckBeacon = () => {
	const app = express();

	app.get('/', function (req, res) {
		res.send('Server is up!');
		console.log('Healthcheck beacon pinged!');
	});

	app.listen(process.env.PORT || 3000);
	console.log('Server is listening!');
};

export { startHealthCheckBeacon };
