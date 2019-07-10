import cookie from 'fastify-cookie';
import glob from 'fast-glob';
import { readFileSync } from 'fs';
import { safeLoadAll } from 'js-yaml';
import chalk from 'chalk';
import { resolve, posix, extname } from 'path';
import { logger, isObject } from './lib/utils';
import {
	FastifyInstance,
	FastifyRequest,
	FastifyError,
	RouteOptions,
	HTTPMethod,
	Plugin
} from 'fastify';
import { Server, IncomingMessage, ServerResponse } from 'http';

const routeMap = new Map();

async function getFiles(dirs: string[], cwd: string): Promise<Array<string>> {
	if (!dirs.length) {
		return [];
	}
	const pArr = dirs.map((dir: string) =>
		glob(posix.join(dir, '**/*.{js,json,yml,yaml}'), {
			absolute: true,
			ignore: ['**/node_modules', '**/.git'],
			cwd
		})
	);
	const rstArr = await Promise.all(pArr);
	return ([] as string[]).concat(...rstArr);
}

type PockPlugin = Plugin<Server, IncomingMessage, ServerResponse, any> & {
	options: any;
};

function loadFile(file: string): SingleRouteFile | MultiRouteFile | PockPlugin | 'error' {
	const ext = extname(file);
	let rst = null;
	try {
		if (ext === '.yml' || ext === '.yaml') {
			rst = safeLoadAll(readFileSync(file, 'utf8'));
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

function isHTTPMethod(str: string): str is HTTPMethod {
	return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(str);
}

function createRoute(key: string, value: any): RouteOptions | null {
	const [method, url, timeout] = key.trim().split(/\s+/);
	if (!url) {
		logger.warn(`Invalid route "${key}". It will be ignored.`);
		return null;
	}
	const $method = method.toUpperCase();

	if (routeMap.has($method + url)) {
		logger.warn(`Route "${$method} ${url}" already exists. The after will be ignored.`);
		return null;
	}

	if (!isHTTPMethod($method)) {
		logger.warn(`Invalid method ${method} in route "${key}". It will be ignored.`);
		return null;
	}
	const $value = value === undefined ? 'undefined' : value,
		route: RouteOptions = {
			method: $method,
			url,
			handler: undefined as any
		};
	if (typeof $value === 'function') {
		route.handler = $value;
	} else if (Array.isArray($value) && $value.some((v: any) => typeof v === 'function')) {
		const handler = $value.pop();
		if (typeof handler !== 'function') {
			logger.warn(
				`Route handler expected a function, but invalid value in "${key}" received. It will be ignored.`
			);
			return null;
		}
		route.handler = handler;
		const preHandler = $value.filter((h: any) => typeof h === 'function');
		if (preHandler.length) {
			route.preHandler = preHandler;
		}
	} else {
		route.handler = async (): Promise<any> => $value;
	}

	const $timeout = parseInt(timeout, 10);
	if (!isNaN($timeout)) {
		if (Array.isArray(route.preHandler)) {
			// tslint:disable-next-line
			route.preHandler.push(() => new Promise(rs => setTimeout(rs, $timeout)));
		} else {
			// tslint:disable-next-line
			route.preHandler = () => new Promise(rs => setTimeout(rs, $timeout));
		}
	}

	routeMap.set(method + url, true);
	return route;
}

interface SingleRouteFile {
	[k: string]: any;
}

type MultiRouteFile = Array<SingleRouteFile>;

function registerRoutes(app: FastifyInstance, obj: SingleRouteFile): void {
	const keys = Object.keys(obj);
	if (!keys.length) {
		logger.warn('Route not found.');
	}
	keys.forEach((k: string) => {
		const route: RouteOptions | null = createRoute(k, obj[k]);
		if (route && !Array.isArray(route.method)) {
			app.route(route);
			logger.success(
				`Route ${chalk.blueBright(route.method)} ${chalk.greenBright(route.url)} created.`
			);
		}
	});
}

function registerRoutesAndPlugins(app: FastifyInstance, files: string[]): void {
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
			app.register(rst as PockPlugin, (rst as PockPlugin).options);
		} else {
			logger.warn(
				'Route file must export a fastify plugin or Object or Array of Object. Otherwise it will be ignored.'
			);
		}
	}
}

export interface RouteLoaderOptions {
	dirs?: string[];
	files?: string[];
	cwd?: string;
}

async function routeLoader(
	app: FastifyInstance,
	{ dirs, files, cwd = process.cwd() }: RouteLoaderOptions
): Promise<void> {
	const dArr = ([] as string[])
			.concat(dirs as string[])
			.filter((dir: string) => typeof dir === 'string' && dir),
		fArr = ([] as string[])
			.concat(files as string[])
			.filter((file: string) => typeof file === 'string' && file)
			.map((file: string) => resolve(cwd, file));

	const partialFiles = await getFiles(dArr, cwd);
	const allFiles = partialFiles.concat(fArr);

	if (!allFiles.length) {
		throw new Error('Route file not found.');
	}

	app.register(cookie);

	app.addHook(
		'onRequest',
		async (req: FastifyRequest): Promise<void> => {
			console.log(
				`Received request ${chalk.blueBright(req.raw.method || 'Unknown Method')} ${chalk.greenBright(req.raw.url || 'Unknown request url')}.`
			);
		}
	);

	app.setErrorHandler(
		async (err: FastifyError, req: FastifyRequest): Promise<FastifyError> => {
			if (err.message.toLowerCase() !== 'not found') {
				const { url } = req.raw;
				const { hostname } = req;
				logger.error(
					`An error occurred when request ${chalk.cyan(hostname + url)}:\n${err.message}`
				);
			}
			return err;
		}
	);

	registerRoutesAndPlugins(app, allFiles);
}

export default routeLoader;
