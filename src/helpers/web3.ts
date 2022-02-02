/* eslint-disable for-direction */
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import * as jsonInterface from '../../contracts/image.sol/image.json';

interface Area {
	x: number;
	y: number;
	cid?: string;
}

const connectToWeb3 = () => {
	// const publicRPCEndpoint = 'wss://rpc-mainnet.matic.quiknode.pro';
	const publicRPCEndpoint = 'https://rpc-mainnet.matic.quiknode.pro';
	return new Web3(publicRPCEndpoint);
};

const getContract = () => {
	const web3 = connectToWeb3();
	return new web3.eth.Contract(jsonInterface.abi as any, '0x36b20Ee53a1120744122f7a2Feb32d9adb5B5F55');
};

const getAreaSide = async (contractToUse?: Contract) => {
	const contract = contractToUse ?? getContract();

	return parseInt(await contract.methods.areaSideLength().call(), 10);
};

const getArea = async (x: number, y: number, contractToUse?: Contract): Promise<{ x: number; y: number; areaData: { imageAddress: string } }> => {
	const contract = contractToUse ?? getContract();
	const data = { x, y, areaData: await contract.methods.getArea(x, y).call() };
	return data;
};

const listAreas = async () => {
	const contract = getContract();
	const areaSideLength = await getAreaSide(contract);

	const xMax = 7680 / areaSideLength;
	const yMax = 4320 / areaSideLength;

	const areas: Area[] = [];

	for (let x = 0; x < xMax; x++) {
		for (let y = 0; y < yMax; y++) {
			areas.push({
				x: x * 30,
				y: y * 30,
			});
		}
	}

	return areas;
};

export { getArea, listAreas, getContract, connectToWeb3, getAreaSide };
