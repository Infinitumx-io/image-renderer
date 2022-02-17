import axios from 'axios';
import { Worker } from 'bullmq';
import fs from 'fs';
import { queueGetImageName, connection } from '@helpers/queue';

const runner = async () => {
	new Worker(
		queueGetImageName,
		async job => {
			const { cid, x, y, kill } = job.data;
			if (kill) {
				console.debug('All images have been downloaded');
				process.exit();
			}
			console.debug(`Starting download of ${cid}`);

			const discoveryUrls = ['https://ipfs.infinitumx.io/CID_HERE', 'https://ipfs.io/ipfs/CID_HERE'];

			let saved = false;

			const discoveries = discoveryUrls.map(
				discoveryUrl =>
					new Promise<boolean | string>(resolve => {
						axios
							.get(discoveryUrl.replace('CID_HERE', cid), { responseType: 'arraybuffer' })
							.then(async response => {
								await fs.writeFileSync(`./images/${x}.${y}.${response.headers['content-type'].split('/')[1]}`, response.data);
								saved = true;
								resolve(`${cid} saved with success`);
							})
							.catch(err => {
								if (!saved) {
									console.debug(`Error getting ${cid} from ${discoveryUrl.replace('CID_HERE', '')}: ${err.message}`);
								}
							});
					}),
			);

			// eslint-disable-next-line no-promise-executor-return
			const timeout = new Promise((resolve, reject) => setTimeout(() => reject(false), 1000 * 60 * 2));

			return Promise.race([...discoveries, timeout])
				.then(response => {
					console.debug(response);
				})
				.catch(err => {
					if (err === false) {
						throw new Error(`Time out during download of ${cid}, sending to queue again\n`);
					}
				});
		},
		{ concurrency: 1, connection },
	);
};

runner();
