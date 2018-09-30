'use strict';
const {logger} = require('./index');
const cleaner = require('./cleaner');

function handleSignal() {
	logger.success('pock stopped.');
	process.exit();
}

function handleExit() {
	cleaner.cleanup();
}

function handleError(e) {
	if (e.msg) {
		logger.error(e.msg);
	} else {
		logger.error(e.message);
	}
	logger.error(e.stack);
	process.exit(1);
}


exports.handleError = handleError;

exports.handleExit = handleExit;

exports.handleSignal = handleSignal;