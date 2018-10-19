'use strict';
const Fastify = require('fastify');
const chalk = require('chalk');
const { promises: fs, exists } = require('fs');
const path = require('path');
const { logger, isObject } = require('./lib/utils');


async function run(
	{
		dirs,
		files,
		static: staticServer,
		static: {
			root,
			prefix: staticPrefix = '/'
		} = {},
		proxy,
		proxy: {
			prefix = '/',
			upstream
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

	let corsEnabled = false, staticServerEnabled = false, proxyEnabled = false, mockServerEnabled = false, wechatAuthEnabled = false;

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

	if (staticServer) {
		root = path.resolve(cwd, root);
		if (!exists(root)) {
			throw new Error(`${root} not found.`);
		}
		app.register(require('fastify-static'), {
			root,
			prefix: staticPrefix
		}).after(err => {
			if (err) {
				throw err;
			}
			staticServerEnabled = true;
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
	if (staticServerEnabled) {
		logger.success(`Static resource host at ${chalk.cyan.underline(staticPrefix)}.`);
	}
	if (proxyEnabled) {
		logger.success(`Proxy enabled. From ${chalk.cyan.underline(new URL(prefix, addr).toString())} to ${chalk.cyan.underline(upstream)}`);
	}
	if (wechatAuthEnabled) {
		logger.success(`Wechat js-sdk authorization enabled. API is ${chalk.cyan.underline(new URL(apiPath, addr).toString())}`);
	}
	logger.success(`Server listening on ${chalk.cyan.underline(addr)}`);


	return app;
}

module.exports = run;