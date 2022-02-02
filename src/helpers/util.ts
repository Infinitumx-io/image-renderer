import CID from 'cids';
import Web3 from 'web3';
import { InvalidArgumentError } from 'commander';
import { cpus } from 'os';
import chalk from 'chalk';

const threadsChecker = (value: any): number => {
	const runningThreads = parseInt(value, 10);
	if (Number.isNaN(runningThreads)) {
		throw new InvalidArgumentError('Please enter a valid number of threads.');
	}

	const availableThreads = cpus().length;
	if (runningThreads >= availableThreads) {
		throw new InvalidArgumentError(`Please use less than ${availableThreads} threads.`);
	}

	return runningThreads;
};

const getCidValue = (imageAddress: string) => {
	return new CID(new Uint8Array(Web3.utils.hexToBytes(imageAddress))).toString();
};

const Logger = (verbose: boolean) => {
	return (level: 'info' | 'success' | 'warn' | 'message', message: any) => {
		if (!verbose) return;

		if (level === 'info') console.log(chalk.bold.cyan(message));
		if (level === 'success') console.log(chalk.bold.green(message));
		if (level === 'warn') console.log(chalk.bold.yellow(message));
		if (level === 'message') console.log(chalk.bold.bold(message));
	};
};

export { threadsChecker, getCidValue, Logger };
