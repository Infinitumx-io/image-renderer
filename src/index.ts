import axios from 'axios';
import cluster from 'cluster';
import { Queue, Worker } from 'bullmq';
import fs from 'fs';
import { Command } from 'commander';
import ora, { Ora } from 'ora';
import { getArea, getContract, listAreas } from './helpers/web3';
import { getCidValue, Logger, threadsChecker } from './helpers/util';
import buildImage from './helpers/buildImage';

const isMain = 'isMaster' in cluster ? cluster.isMaster : cluster.isPrimary;

const program = new Command();
program.version('1.0.0', '--version', 'InfinitumX Image Renderer');

const queueGetAreaDataName = 'InfinitumXImageRendererGetAreaData';
const queueGetAreaData = new Queue(queueGetAreaDataName, {
	connection: {
		enableOfflineQueue: false,
	},
});
const queueGetImageName = 'InfinitumXImageRendererGetImage';
const queueGetImage = new Queue(queueGetImageName, {
	connection: {
		enableOfflineQueue: false,
	},
});

interface Options {
	threads: number;
	verbose: boolean;
}

const isGetAreaDone = async () => {
	return (await queueGetAreaData.getActiveCount()) === 0 && (await queueGetAreaData.getWaitingCount()) === 0 && (await queueGetAreaData.getDelayedCount()) === 0;
};

const isGetImageDone = async () => {
	return (await queueGetImage.getActiveCount()) === 0 && (await queueGetImage.getWaitingCount()) === 0 && (await queueGetImage.getDelayedCount()) === 0;
};

if (isMain) {
	(async () => {
		program
			.option('-t, --threads <threads>', 'Number of threads to run the image renderer', threadsChecker, 4)
			.option('-v, --verbose', 'Show verbose logs', false)
			.action(async (options: Options) => {
				console.time('Execution Time');
				const logger = Logger(options.verbose);

				let spinner: Ora | undefined;

				if (!options.verbose) {
					spinner = ora('Running Image Renderer');
					spinner.start();
				} else {
					console.clear();
				}

				logger('message', `Starting Infinitum X Image Renderer with ${options.threads} threads`);
				for (let i = 0; i < options.threads; i++) cluster.fork();

				logger('message', `Cleaning queues`);
				await queueGetAreaData.drain();
				await queueGetImage.drain();
				await queueGetAreaData.obliterate({ force: true });
				await queueGetImage.obliterate({ force: true });

				await queueGetImage.pause();

				logger('message', `Creating images folder`);
				await fs.mkdirSync('./images/', { recursive: true });

				logger('message', `Getting list of areas to process`);
				const areas = await listAreas();

				logger('message', `Sending areas to queue`);
				for await (const area of areas) {
					await queueGetAreaData.add(
						'GetArea',
						{
							...area,
							verbose: options.verbose,
						},
						{ attempts: 10, backoff: { type: 'exponential', delay: 1000 } },
					);
				}

				setInterval(async () => {
					const queueGetAreaDone = await isGetAreaDone();
					const queueGetImageDone = await isGetImageDone();

					if ((await queueGetAreaData.getWaitingCount()) === 0 && (await queueGetAreaData.getDelayedCount()) === 0) {
						await queueGetImage.resume();
					}

					if (queueGetAreaDone && queueGetImageDone) {
						console.timeEnd('Execution Time');
						await buildImage();
						if (spinner) {
							spinner.text = 'Image Renderer completed';
							spinner.stop();
						}
						process.exit();
					}
				}, 2000);
			});
		await program.parseAsync(process.argv);
	})();
} else {
	(async () => {
		const workerId = `Worker ${cluster?.worker?.id}: ` ?? '';
		const contract = getContract();

		new Worker(
			queueGetImageName,
			async job => {
				const { cid, x, y, verbose } = job.data;
				const logger = Logger(verbose);
				logger('info', `${workerId}Starting download of ${cid}`);

				const discoveryUrls = [
					'https://cloudflare-ipfs.com/ipfs/CID_HERE',
					'https://ipfs.io/ipfs/CID_HERE',
					'https://gateway.ipfs.io/ipfs/CID_HERE',
					'https://ipfs.fleek.co/ipfs/CID_HERE',
					'https://ipfs.io/ipfs/CID_HERE',
					'https://ipfs.infinitumx.io/CID_HERE',
				];

				const discoveries = discoveryUrls.map(
					discoveryUrl =>
						new Promise<boolean | string>(resolve => {
							axios
								.get(discoveryUrl.replace('CID_HERE', cid), { responseType: 'arraybuffer' })
								.then(async response => {
									await fs.writeFileSync(`./images/${x}.${y}.${response.headers['content-type'].split('/')[1]}`, response.data);
									resolve(`${workerId}${cid} saved with success`);
								})
								.catch(err => {
									logger('warn', `${workerId}Error getting ${cid} from ${discoveryUrl.replace('CID_HERE', '')}: ${err.message}`);
								});
						}),
				);

				// eslint-disable-next-line no-promise-executor-return
				const timeout = new Promise((resolve, reject) => setTimeout(() => reject(false), 1000 * 60 * 2));

				return Promise.race([...discoveries, timeout])
					.then(response => {
						logger('success', response);
					})
					.catch(err => {
						if (err === false) {
							throw new Error(`Time out during download of ${cid}, sending to queue again\n`);
						}
					});
			},
			{ concurrency: 1, connection: {} },
		);

		new Worker(
			queueGetAreaDataName,
			async (job: any) => {
				const { x, y, verbose } = job.data;
				const logger = Logger(verbose);
				logger('info', `${workerId}Getting area ${x} / ${y} data`);
				const areaData = await getArea(x, y, contract);
				logger('success', `${workerId}Area ${x} / ${y} data was successfully got`);

				if (areaData.areaData.imageAddress !== '0x') {
					const cid = getCidValue(areaData.areaData.imageAddress);

					logger('info', `${workerId}Sending ${cid} to get image queue`);

					await queueGetImage.add(
						'GetImage',
						{
							x: areaData.x,
							y: areaData.y,
							cid,
							verbose: job.data.verbose,
						},
						{ attempts: 10, backoff: { type: 'exponential', delay: 10000 } },
					);
				}

				return true;
			},
			{ concurrency: 1, connection: {} },
		);
	})();
}
