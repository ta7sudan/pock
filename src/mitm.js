'use strict';
const { Server, request } = require('http');
const { createConnection } = require('net');
const chalk = require('chalk');
const { logger } = require('./lib/utils');

function rand(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 先写个low b版的, 有空再加功能
async function mitm(options) {
	// 不在参数解构是考虑到时候也许直接把options传给某个库
	const { origin, dest, log = false, host = '0.0.0.0', port = rand(1025, 65535) } = options;
	if (typeof origin !== 'string' || !origin || typeof dest !== 'string' || !dest) {
		throw new TypeError('origin and dest in mitm options must set correctly.');
	}

	if (origin === dest) {
		throw new Error('Same origin and dest may cause request loop.');
	}

	const [originHostname, originPort = 80] = origin.trim().toLowerCase().split(':');
	const [destHostname, destPort = 80] = dest.trim().toLowerCase().split(':');

	const server = new Server();

	// 目前只支持HTTP代理
	server.on('request', (cReq, cRes) => {
		let { hostname, port, pathname } = new URL(cReq.url);
		port = port || 80;

		let opts = {
			protocol: 'http:',
			method: cReq.method,
			path: pathname,
			headers: cReq.headers
		};
		if (hostname === originHostname && port == originPort) {
			opts.hostname = destHostname;
			opts.port = parseInt(destPort, 10);
		} else {
			opts.hostname = hostname;
			opts.port = parseInt(port, 10);
		}
		const sReq = request(opts, sRes => {
			cRes.writeHead(sRes.statusCode, sRes.statusMessage, sRes.headers);
			sRes.pipe(cRes);
		});

		sReq.on('error', function (err) {
			log && logger.error(err.message);
			this.end();
		});

		cReq.pipe(sReq);
	});

	server.on('connect', (req, cSocket, header) => {
		const [hostname, port] = req.url.split(':');
		const sSocket = createConnection(parseInt(port, 10) || 443, hostname, function () {
			cSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
			this.write(header);
			this.pipe(cSocket).pipe(this);
		});

		sSocket.on('error', function (err) {
			log && logger.error(err.message);
			this.end();
		});

		cSocket.on('error', function (err) {
			log && logger.error(err.message);
			this.end();
		});
	});

	server.on('error', err => {
		logger.error(err.message);
	});

	// 什么傻屌操作???
	let resolve = null;
	const delayLog = new Promise(rs => resolve = rs);
	server.listen(parseInt(port, 10), host, err => {
		if (err) {
			throw err;
		}
		resolve();
	});

	await delayLog;
	logger.success(`MITM proxy listening on ${chalk.cyan.underline(`http://${host}:${port}`)} From ${chalk.cyan.underline(origin)} to ${chalk.cyan.underline(dest)}`);


	return server;
}

module.exports = mitm;
