'use strict';
const { logger, cleaner } = require('./lib/utils');

async function main(options, cwd = process.cwd()) {
	const { watch, dirs, files, static: root, wechat, proxy, mitm } = options;
	const hasMockServer = dirs || files || root || proxy || wechat, hasMitmProxy = mitm;

	// 可以被作为API调用, 所以多做一次类型检查
	if (!hasMockServer && !hasMitmProxy) {
		throw new Error('One of dirs, files, static, proxy, mitm, wechat must set, but none was found.');
	}

	if (proxy && mitm) {
		throw new Error('proxy is conflicted with mitm.');
	}

	if (hasMockServer) {
		logger.note('Starting server...');
		const server = await require(watch ? './watch' : './server')(options, cwd);
		cleaner.server = server;
	}

	if (hasMitmProxy) {
		const mitmProxy = await require('./mitm')(mitm);
		cleaner.mitmProxy = mitmProxy;
	}
}

module.exports = main;
