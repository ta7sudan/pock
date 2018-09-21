'use strict';
const {logger} = require('./index');

function handleExit() {
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
	process.exit(1);
}


exports.handleError = handleError;

exports.handleExit = handleExit;
