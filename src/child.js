'use strict';
const { logger, status: { ALREADY_START, INTERNAL_ERROR } } = require('./lib/utils');

let server = null;

function handleError(err) {
	logger.error(err.message);
	logger.error(err.stack);
	process.send(INTERNAL_ERROR);
	setTimeout(() => process.exit(1), 30);
}

process.send(ALREADY_START);

process.addListener('SIGTERM', () => {
	if (server) {
		server.close();
	}
	process.exit();
});

process.addListener('unhandledRejection', handleError);

process.addListener('uncaughtException', handleError);

process.addListener('message', async ({options, cwd}) => {
	server = await require('./server')(options, cwd);
});
