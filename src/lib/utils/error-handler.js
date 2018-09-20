'use strict';
const chalk = require('chalk');
const ora = require('ora');
const cleaner = require('./cleanup');
const {logger} = require('./index');

async function handleExit() {
	const spiner = ora('do clean up...\n').start();
	try {
		await cleaner.cleanUp();
		spiner.succeed('Exiting without error.');
	} catch (e) {
		logger.error(`Clean up failed. Error message: ${e.message}`);
		console.error(chalk.red(e.stack));
		process.exit(1);
	}
	process.exit();
}

async function handleError(e) {
	if (e.msg) {
		logger.error(e.msg);
	} else {
		logger.error(e.message);
	}
	console.error(chalk.red(e.stack));

	const spiner = ora('do clean up...\n').start();
	try {
		await cleaner.cleanUp();
		spiner.succeed('clean up done.');
	} catch (err) {
		logger.error(`Clean up failed. Error message: ${err.message}`);
		console.error(chalk.red(err.stack));
	}
	process.exit(1);
}


exports.handleError = handleError;

exports.handleExit = handleExit;
