'use strict';
const { logger } = require('./lib/utils');

/**
 * TODO, 如果需要支持作为模块引入, 那应当在这里考虑合适的异常处理和未捕获的
 * Promise 的处理方案
 */

function main(options) {
	const { watch } = options;

	if (!watch) {
		logger.note('Starting server...');
	}
	require(watch ? './watch' : './server')(options, process.cwd());
}

module.exports = main;
