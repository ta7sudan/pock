'use strict';
const Fastify = require('fastify');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const {logger, isObject} = require('./lib/utils');


async function run(
	{
		dirs,
		files,
		proxy,
		proxy: {
			upstream
		} = {},
		mitm,
		wechat,
		ssl,
		ssl: { cert, key } = {},
		host = '0.0.0.0',
		port = 3000,
		cors
	},
	cwd = process.cwd()
) {

	// 可以被作为API调用, 所以多做一次类型检查
	// await sleep(10000);
	if (!dirs && !files && !proxy && !mitm && !wechat) {
		throw new Error('One of dirs, files, proxy, mitm, wechat must set, but none was found.');
	}

	if (proxy && mitm) {
		throw new Error('proxy is conflicted with mitm.');
	}

	let appOptions = {
		bodyLimit: 10485760
	};

	// HTTPS
	if (ssl) {
		if (typeof cert !== 'string' || typeof key !== 'string') {
			throw new TypeError('Expected cert, key to be a string when ssl is set.');
		}
		const [oKey, oCert] = await Promise.all([fs.readFile(path.resolve(cwd, key)), fs.readFile(path.resolve(cwd, cert))]);
		appOptions.https = {
			key: oKey,
			cert: oCert
		};
	}

	const app = Fastify(appOptions);

	// CORS, 考虑下要不要只给http server加不给代理加
	if (cors === true || isObject(cors)) {
		const corsOptions = isObject(cors) ? cors : {
			origin: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowedHeaders: ['Content-Type', 'Content-Length', 'Accept', 'Accept-Charset', 'Accept-Encoding', 'Authorization', 'X-Requested-With', 'Token'],
			credentials: true,
			maxAge: 7200
		};
		app.register(require('fastify-cors'), corsOptions);
	}

	// Proxy
	if (proxy) {
		if (typeof upstream !== 'string' || !upstream) {
			throw new TypeError('upstream must set, such as http://www.example.com');
		}
		proxy.prefix = typeof proxy.prefix === 'string' && proxy.prefix ? proxy.prefix : '/';
		app.register(require('fastify-http-proxy'), proxy);
	}

	// Mitm
	if (mitm) {
		app.register(require('./mitm'), mitm);
	}

	// Wechat auth
	if (wechat) {
		app.register(require('./wechat-auth'), wechat);
	}

	// Load routes
	if (dirs || files) {
		app.register(require('./route-loader'), {
			dirs,
			files,
			cwd
		});
	}

	// 插件加载出错直接crash
	app.ready(err => {
		if (err) {
			throw err;
		}
	});


	// 如果抛出异常交给进程全局异常捕获
	const addr = await app.listen(parseInt(port, 10), host);
	logger.success(`Server listening on ${chalk.cyan.underline(addr)}`);

	return app;
}

module.exports = run;