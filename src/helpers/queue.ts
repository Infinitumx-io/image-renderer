import { Queue } from 'bullmq';

const connection = {
	host: 'redis',
	port: '6379',
};

const queueGetAreaDataName = 'InfinitumXImageRendererGetAreaData';
const queueGetAreaData = new Queue(queueGetAreaDataName, {
	connection: {
		enableOfflineQueue: false,
		...connection,
	},
});
const queueGetImageName = 'InfinitumXImageRendererGetImage';
const queueGetImage = new Queue(queueGetImageName, {
	connection: {
		enableOfflineQueue: false,
		...connection,
	},
});

const isGetAreaDone = async () => {
	return (await queueGetAreaData.getActiveCount()) === 0 && (await queueGetAreaData.getWaitingCount()) === 0 && (await queueGetAreaData.getDelayedCount()) === 0;
};

const isGetImageDone = async () => {
	return (await queueGetImage.getActiveCount()) === 0 && (await queueGetImage.getWaitingCount()) === 0 && (await queueGetImage.getDelayedCount()) === 0;
};

export { queueGetImage, queueGetImageName, queueGetAreaData, queueGetAreaDataName, connection, isGetAreaDone, isGetImageDone };
