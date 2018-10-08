'use strict';
const {logger, cleaner} = require('./index');

function handleSignal() {
	cleaner.cleanup();
	logger.success('pock stopped.');
	process.exit();
}

function handleError(e) {
	if (e.msg) {
		logger.error(e.msg);
	} else {
		logger.error(e.message);
	}
	logger.error(e.stack);
	cleaner.cleanup();
	process.exit(1);
}


exports.handleError = handleError;

exports.handleSignal = handleSignal;