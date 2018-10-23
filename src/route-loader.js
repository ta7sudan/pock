'use strict';
const cookie = require('fastify-cookie');
const glob = require('fast-glob');
const fs = require('fs');
const yaml = require('js-yaml');
const chalk = require('chalk');
const path = require('path');
const { logger, isObject } = require('./lib/utils');
const routeMap = new Map();

async function getFiles(dirs, cwd) {
	if (!dirs.length) {
		return [];
	}
	const pArr = dirs.map(dir => glob(path.join(dir, '**/*.{js,json,yml,yaml}'), {
		absolute: true,
		ignore: ['**/node_modules', '**/.git'],
		cwd
	}));
	const rstArr = await Promise.all(pArr);
	return [].concat(...rstArr);
}

function loadFile(file) {
	const ext = path.extname(file);
	let rst = null;
	try {
		if (ext === '.yml' || ext === '.yaml') {
			rst = yaml.safeLoadAll(fs.readFileSync(file, 'utf8'));
		} else {
			rst = require(file);
		}
	} catch (e) {
		logger.warn(`An error occurred when load ${chalk.underline(file)}, it will be ignored.`);
		logger.error(e.message);
		rst = 'error';
	}
	return rst;
}


function createRoute(key, value) {
	let [method, url, timeout] = key.trim().split(/\s+/);
	if (!url) {
		logger.warn(`Invalid route "${key}". It will be ignored.`);
		return null;
	}
	method = method.toUpperCase();

	if (routeMap.has(method + url)) {
		logger.warn(`Route "${method} ${url}" already exists. The after will be ignored.`);
		return null;
	}

	if (!(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method))) {
		logger.warn(`Invalid method ${method} in route "${key}". It will be ignored.`);
		return null;
	}

	if (value === undefined) {
		value = 'undefined';
	}

	const route = {
		method,
		url
	};
	if (typeof value === 'function') {
		route.handler = value;
	} else if (Array.isArray(value) && value.some(v => typeof v === 'function')) {
		const handler = value.pop();
		if (typeof handler !== 'function') {
			logger.warn(`Route handler expected a function, but invalid value in "${key}" received. It will be ignored.`);
			return null;
		}
		route.handler = handler;
		const beforeHandler = value.filter(h => typeof h === 'function');
		if (beforeHandler.length) {
			route.beforeHandler = beforeHandler;
		}
	} else {
		route.handler = async () => value;
	}

	timeout = parseInt(timeout, 10);
	if (!isNaN(timeout)) {
		if (Array.isArray(route.beforeHandler)) {
			route.beforeHandler.push(() => new Promise(rs => setTimeout(rs, timeout)));
		} else {
			route.beforeHandler = () => new Promise(rs => setTimeout(rs, timeout));
		}
	}

	routeMap.set(method + url, true);
	return route;
}


function registerRoutes(app, obj) {
	const keys = Object.keys(obj);
	if (!keys.length) {
		logger.warn('Route not found.');
	}
	keys.forEach(k => {
		const route = createRoute(k, obj[k]);
		if (route) {
			app.route(route);
			logger.success(`Route ${chalk.blueBright(route.method)} ${chalk.greenBright(route.url)} created.`);
		}
	});
}

function registerRoutesAndPlugins(app, files) {
	logger.note('Register routes and plugins...');
	// 不保证路由和插件之间的相对顺序
	for (const file of files) {
		console.log(`Loading file: ${chalk.cyan.underline(file)}...`);
		const rst = loadFile(file);
		if (rst === 'error') {
			continue;
		}
		if (isObject(rst)) {
			registerRoutes(app, rst);
		} else if (Array.isArray(rst)) {
			if (!rst.length) {
				logger.warn('Route not found.');
			}
			for (const v of rst) {
				if (isObject(v)) {
					registerRoutes(app, v);
				} else {
					// 其他类型的忽略
					logger.warn('Route not found.');
				}
			}
		} else if (typeof rst === 'function') {
			logger.success('Plugin found.');
			app.register(rst, rst.options);
		} else {
			logger.warn('Route file must export a fastify plugin or Object or Array of Object. Otherwise it will be ignored.');
		}
	}
}

async function routeLoader(app, {
	dirs,
	files,
	cwd = process.cwd()
}) {
	const dArr = [].concat(dirs).filter(dir => typeof dir === 'string' && dir),
		fArr = [].concat(files).filter(file => typeof file === 'string' && file).map(file => path.resolve(cwd, file));

	const partialFiles = await getFiles(dArr, cwd);
	const allFiles = partialFiles.concat(fArr);

	if (!allFiles.length) {
		throw new Error('Route file not found.');
	}

	app.register(cookie, err => {
		if (err) throw err;
	});

	app.addHook('onRequest', async req => {
		console.log(`Received request ${chalk.blueBright(req.method)} ${chalk.greenBright(req.url)}.`);
	});

	app.setErrorHandler(async (err, req) => {
		if (err.message.toLowerCase() !== 'not found') {
			const { hostname, url } = req.raw;
			logger.error(`An error occurred when request ${chalk.cyan(hostname + url)}:\n${err.message}`);
		}
		return err;
	});

	registerRoutesAndPlugins(app, allFiles);

}

module.exports = routeLoader;