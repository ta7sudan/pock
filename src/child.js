'use strict';
const { logger, status: { ALREADY_START, INTERNAL_ERROR } } = require('./lib/utils');

process.send(ALREADY_START);

process.addListener('SIGTERM', () => process.exit());

process.addListener('uncaughtException', err => {
	logger.error(err.message);
	logger.error(err.stack);
	process.send(INTERNAL_ERROR);
	setTimeout(() => process.exit(1), 30);
});

process.addListener('message', ({options, cwd}) => {
	require('./server')(options, cwd);
});
