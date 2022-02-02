import fs from 'fs';
import Jimp from 'jimp';
import { getAreaSide } from './web3';

const buildImage = async () => {
	const areaSideLength = await getAreaSide();
	const baseImage = await Jimp.create(7680, 4320);

	const images = await fs.readdirSync('./images');

	for (const image of images) {
		const imageArea = await Jimp.read(`./images/${image}`);
		const coordinates = image.split('.');
		const x = +coordinates[0];
		const y = +coordinates[1];

		await baseImage.blit(imageArea, +x, +y, 0, 0, areaSideLength, areaSideLength);
	}

	const buffer = await baseImage.getBufferAsync(Jimp.MIME_PNG);
	await fs.writeFileSync('./infinitumx.png', buffer);
};

export default buildImage;
