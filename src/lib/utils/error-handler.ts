import chalk from 'chalk';
import { logger, cleaner, sleep } from './index';

// 尽量不要用async函数来做最终的异常处理
async function handleSignal(signal: string): Promise<void> {
	try {
		cleaner.cleanup();
		logger.success('pock stopped.');
	} catch (e) {
		logger.error(`Clean up failed. Error message: ${e.message}`);
		console.error(chalk.red(e.stack));
		process.exit(1);
		return;
	}
	await sleep(50);
	process.exit();
}

interface CustomError {
	msg: string;
	stack: string;
}

function isCustomError(e: any): e is CustomError {
	return !!e.msg;
}

// 尽量不要用async函数来做最终的异常处理
async function handleError(e: Error | CustomError): Promise<any> {
	if (isCustomError(e)) {
		logger.error(e.msg);
	} else {
		logger.error(e.message);
	}

	console.error(chalk.red(e.stack as string));

	try {
		cleaner.cleanup();
	} catch (err) {
		logger.error(`Clean up failed. Error message: ${err.message}`);
		console.error(chalk.red(err.stack));
	}
	await sleep(50);
	process.exit(1);
}

export { handleError, handleSignal };
