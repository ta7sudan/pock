'use strict';
const Fastify = require('fastify');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const { logger, isObject, sleep } = require('./lib/utils');


async function run(
	{
		dirs,
		files,
		proxy,
		proxy: {
			prefix,
			upstream
		} = {},
		mitm,
		mitm: {
			origin,
			dest
		} = {},
		wechat,
		wechat: {
			path: apiPath = '/wechat-config'
		} = {},
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

	let corsEnabled = false, proxyEnabled = false, mockServerEnabled = false, mitmEnabled = false, wechatAuthEnabled = false;

	// CORS, 考虑下要不要只给http server加不给代理加
	if (cors === true || isObject(cors)) {
		const corsOptions = isObject(cors) ? cors : {
			origin: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowedHeaders: ['Content-Type', 'Content-Length', 'Accept', 'Accept-Charset', 'Accept-Encoding', 'Authorization', 'X-Requested-With', 'Token'],
			credentials: true,
			maxAge: 7200
		};
		app.register(require('fastify-cors'), corsOptions).after(err => {
			if (err) {
				throw err;
			}
			corsEnabled = true;
		});
	}

	// Proxy
	if (proxy) {
		if (typeof upstream !== 'string' || !upstream) {
			throw new TypeError('upstream must set, such as http://www.example.com');
		}
		proxy.prefix = typeof prefix === 'string' && prefix ? prefix : '/';
		app.register(require('fastify-http-proxy'), proxy).after(err => {
			if (err) {
				throw err;
			}
			proxyEnabled = true;
		});
	}

	// Mitm
	if (mitm) {
		app.register(require('./mitm'), mitm).after(err => {
			if (err) {
				throw err;
			}
			mitmEnabled = true;
		});
	}

	// Wechat auth
	if (wechat) {
		app.register(require('./wechat-auth'), wechat).after(err => {
			if (err) {
				throw err;
			}
			wechatAuthEnabled = true;
		});
	}

	// Load routes
	if (dirs || files) {
		app.register(require('./route-loader'), {
			dirs,
			files,
			cwd
		}).after(err => {
			if (err) {
				throw err;
			}
			mockServerEnabled = true;
		});
	}

	// 插件加载出错直接crash
	app.ready(err => {
		if (err) {
			throw err;
		}
	});

	app.setErrorHandler(async err => {
		if (err.message.toLowerCase() !== 'not found') {
			logger.error(err.message);
			logger.error(err.stack);
		}
		return err;
	});

	// 如果抛出异常交给进程全局异常捕获
	const addr = await app.listen(parseInt(port, 10), host);
	if (mockServerEnabled) {
		logger.success(`All custom routes and plugins are ready.\n\n${chalk.yellow(app.printRoutes())}`);
	}
	if (corsEnabled) {
		logger.success('CORS enabled.');
	}
	if (proxyEnabled) {
		logger.success(`Proxy enabled. From ${chalk.cyan.underline(new URL(prefix, addr).toString())} to ${chalk.cyan.underline(upstream)}`);
	}
	if (mitmEnabled) {
		logger.success(`MITM enabled. From ${chalk.cyan.underline(origin)} to ${chalk.cyan.underline(dest)}`);
	}
	if (wechatAuthEnabled) {
		logger.success(`Wechat js-sdk authorization enabled. API is ${chalk.cyan.underline(new URL(apiPath, addr).toString())}`);
	}
	logger.success(`Server listening on ${chalk.cyan.underline(addr)}`);

	return app;
}

module.exports = run;