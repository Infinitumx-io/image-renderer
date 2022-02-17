import CID from 'cids';
import Web3 from 'web3';

const getCidValue = (imageAddress: string) => {
	return new CID(new Uint8Array(Web3.utils.hexToBytes(imageAddress))).toString();
};

export { getCidValue };
