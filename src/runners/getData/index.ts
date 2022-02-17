import { Worker } from 'bullmq';
import { getArea, getContract } from '@helpers/web3';
import { queueGetImage, queueGetAreaDataName, connection } from '@helpers/queue';
import { getCidValue } from '@helpers/util';

const runner = async () => {
	const contract = getContract();

	new Worker(
		queueGetAreaDataName,
		async (job: any) => {
			const { x, y, kill } = job.data;
			if (kill) {
				console.debug('All data has been collected...');
				process.exit();
			}
			console.debug(`Getting area ${x} / ${y} data`);
			const areaData = await getArea(x, y, contract);
			console.debug(`Area ${x} / ${y} data successfully retrieved`);

			if (areaData.areaData.imageAddress !== '0x') {
				const cid = getCidValue(areaData.areaData.imageAddress);

				console.debug(`Sending ${cid} to get image queue`);

				await queueGetImage.add(
					'GetImage',
					{
						x: areaData.x,
						y: areaData.y,
						cid,
						kill: false,
					},
					{ attempts: 10, backoff: { type: 'exponential', delay: 10000 } },
				);
			}

			return true;
		},
		{ concurrency: 1, connection },
	);
};

runner();
