import fs from 'fs';
import { listAreas } from '@helpers/web3';
import buildImage from '@helpers/buildImage';
import { queueGetImage, queueGetAreaData, isGetAreaDone, isGetImageDone } from '@helpers/queue';

const runner = async () => {
	console.time('Execution Time');

	console.debug(`Starting Infinitum X Image Renderer`);

	console.debug(`Cleaning queues`);
	await queueGetAreaData.drain();
	await queueGetImage.drain();
	await queueGetAreaData.obliterate({ force: true });
	await queueGetImage.obliterate({ force: true });

	await fs.mkdirSync('./images/', { recursive: true });

	console.debug(`Getting list of areas to process`);
	const areas = await listAreas();

	console.debug(`Sending areas to queue`);
	for await (const area of areas) {
		await queueGetAreaData.add('GetArea', { ...area, kill: false }, { attempts: 10, backoff: { type: 'exponential', delay: 1000 } });
	}

	setInterval(async () => {
		const queueGetAreaDone = await isGetAreaDone();
		const queueGetImageDone = await isGetImageDone();

		if (queueGetAreaDone && queueGetImageDone) {
			await queueGetAreaData.add('GetArea', { kill: true });
			await queueGetImage.add('GetImage', { kill: true });

			console.timeEnd('Execution Time');
			await buildImage();
			console.debug(`Image built successfully, you can find it at the root folder of this repo as infinitumx.png`);
			process.exit();
		}
	}, 2000);
};

runner();
