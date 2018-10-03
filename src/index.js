'use strict';
const { logger, cleaner } = require('./lib/utils');

async function main(options) {
	const { watch } = options;

	if (!watch) {
		logger.note('Starting server...');
	}
	const server = await require(watch ? './watch' : './server')(options, process.cwd());
	cleaner.server = server;
}

module.exports = main;
