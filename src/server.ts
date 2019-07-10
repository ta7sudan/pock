import Fastify, {
	ServerOptionsAsSecureHttp,
	FastifyRequest,
	FastifyReply,
	FastifyError,
	DefaultQuery,
	DefaultParams,
	DefaultHeaders,
	FastifyInstance
} from 'fastify';
import chalk from 'chalk';
import { promises as fs, existsSync as exists } from 'fs';
import { resolve } from 'path';
import { logger, isObject } from './lib/utils';
import { SecureServerOptions, Http2ServerResponse, Http2ServerRequest } from 'http2';
import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { WechatOptions } from './wechat-auth';

// from fastify-cors
type originCallback = (err: Error, allow: boolean) => void;

type originFunction = (origin: string, callback: originCallback) => void;
interface CORSOptions {
	origin?: string | boolean | RegExp | string[] | RegExp[] | originFunction;
	credentials?: boolean;
	exposedHeaders?: string | string[];
	allowedHeaders?: string | string[];
	methods?: string | string[];
	maxAge?: number;
	preflightContinue?: boolean;
	optionsSuccessStatus?: number;
	preflight?: boolean;
}

// from fastify-static
interface StaticOptions {
	root: string;
	prefix?: string;
	serve?: boolean;
	decorateReply?: boolean;
	schemaHide?: boolean;
	setHeaders?: (...args: any[]) => void;
	redirect?: boolean;
	wildcard?: boolean | string;
	acceptRanges?: boolean;
	cacheControl?: boolean;
	dotfiles?: boolean;
	etag?: boolean;
	extensions?: string[];
	immutable?: boolean;
	index?: string[];
	lastModified?: boolean;
	maxAge?: string | number;
}

// from fastify-http-proxy
type HttpRequest = IncomingMessage | Http2ServerRequest;
type HttpResponse = ServerResponse | Http2ServerResponse;
interface ProxyOptions {
	upstream: string;
	prefix?: string;
	rewritePrefix?: string;
	http2?: boolean;
	preHandler?: (
		request: FastifyRequest<HttpRequest, DefaultQuery, DefaultParams, DefaultHeaders, any>,
		reply: FastifyReply<HttpResponse>,
		next: (err?: FastifyError | undefined) => void
	) => void;
	beforeHandler?: (
		request: FastifyRequest<HttpRequest, DefaultQuery, DefaultParams, DefaultHeaders, any>,
		reply: FastifyReply<HttpResponse>,
		next: (err?: FastifyError | undefined) => void
	) => void;
	config?: object;
	replyOptions?: object;
}

export interface ServerOptions {
	dirs?: Array<string>;
	files?: Array<string>;
	static?: StaticOptions;
	proxy?: ProxyOptions;
	wechat?: WechatOptions;
	ssl?: {
		cert: string | Buffer;
		key: string | Buffer;
	};
	host?: string;
	port?: number;
	cors?: CORSOptions | boolean;
}

async function run(
	{
		dirs,
		files,
		static: staticServer,
		// static: {
		// 	root,
		// 	prefix: staticPrefix = '/'
		// } = {},
		proxy,
		// proxy: {
		// 	prefix = '/',
		// 	upstream
		// } = {},
		wechat,
		// wechat: {
		// 	path: apiPath = '/wechat-config'
		// } = {},
		ssl,
		// ssl: { cert, key } = {},
		host = '0.0.0.0',
		port = 3000,
		cors
	}: ServerOptions,
	cwd: string = process.cwd()
): Promise<FastifyInstance> {
	const appOptions: ServerOptionsAsSecureHttp | ServerOptionsAsSecureHttp = {
		bodyLimit: 10485760,
		https: (undefined as unknown) as SecureServerOptions
	};

	// HTTPS
	if (ssl) {
		const { cert: certPath, key: keyPath } = ssl;
		if (typeof certPath !== 'string' || typeof keyPath !== 'string') {
			throw new TypeError('Expected cert, key to be a string when ssl is set.');
		}
		const [key, cert] = await Promise.all([
			fs.readFile(resolve(cwd, keyPath)),
			fs.readFile(resolve(cwd, certPath))
		]);
		appOptions.https = {
			key,
			cert
		};
	}

	const app = Fastify(appOptions);

	let corsEnabled = false,
		staticServerEnabled = false,
		proxyEnabled = false,
		mockServerEnabled = false,
		wechatAuthEnabled = false,
		$staticPrefix = '',
		$prefix = '',
		$upstream = '',
		$apiPath = '';

	// CORS, 考虑下要不要只给http server加不给代理加
	if (cors === true || isObject(cors)) {
		const corsOptions: CORSOptions = isObject(cors)
			? (cors as CORSOptions)
			: {
					origin: true,
					methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
					allowedHeaders: [
						'Content-Type',
						'Content-Length',
						'Accept',
						'Accept-Charset',
						'Accept-Encoding',
						'Authorization',
						'X-Requested-With',
						'Token'
					],
					credentials: true,
					maxAge: 7200
				};
		app.register(require('fastify-cors'), corsOptions).after((err: Error): void => {
			if (err) {
				throw err;
			}
			corsEnabled = true;
		});
	}

	if (staticServer) {
		const { root, prefix: staticPrefix = '/' } = staticServer;
		const $root = resolve(cwd, root);
		if (!exists($root)) {
			throw new Error(`${$root} not found.`);
		}
		$staticPrefix = staticPrefix;
		app
			.register(require('fastify-static'), {
				...staticServer,
				root: $root,
				prefix: staticPrefix
			})
			.after((err: Error): void => {
				if (err) {
					throw err;
				}
				staticServerEnabled = true;
			});
	}

	// Proxy
	if (proxy) {
		const { upstream, prefix } = proxy;
		if (typeof upstream !== 'string' || !upstream) {
			throw new TypeError('upstream must set, such as http://www.example.com');
		}
		proxy.prefix = typeof prefix === 'string' && prefix ? prefix : '/';
		$prefix = proxy.prefix;
		$upstream = proxy.upstream;
		app.register(require('fastify-http-proxy'), proxy).after((err: Error): void => {
			if (err) {
				throw err;
			}
			proxyEnabled = true;
		});
	}

	// Wechat auth
	if (wechat) {
		!wechat.path && (wechat.path = $apiPath = '/wechat-config');
		app.register(require('./wechat-auth').default, wechat).after((err: Error): void => {
			if (err) {
				throw err;
			}
			wechatAuthEnabled = true;
		});
	}

	// Load routes
	if (dirs || files) {
		app
			.register(require('./route-loader').default, {
				dirs,
				files,
				cwd
			})
			.after((err: Error): void => {
				if (err) {
					throw err;
				}
				mockServerEnabled = true;
			});
	}

	// 插件加载出错直接crash
	app.ready((err: Error): void => {
		if (err) {
			throw err;
		}
	});

	app.setErrorHandler(
		async (err: Error): Promise<Error> => {
			if (err.message.toLowerCase() !== 'not found') {
				logger.error(err.message);
				logger.error(err.stack!);
			}
			return err;
		}
	);

	// 如果抛出异常交给进程全局异常捕获
	const addr = await app.listen(port, host);
	if (mockServerEnabled) {
		logger.success(
			`All custom routes and plugins are ready.\n\n${chalk.yellow(app.printRoutes())}`
		);
	}
	if (corsEnabled) {
		logger.success('CORS enabled.');
	}
	if (staticServerEnabled) {
		logger.success(`Static resource host at ${chalk.cyan.underline($staticPrefix)}.`);
	}
	if (proxyEnabled) {
		logger.success(
			`Proxy enabled. From ${chalk.cyan.underline(
				new URL($prefix, addr).toString()
			)} to ${chalk.cyan.underline($upstream)}`
		);
	}
	if (wechatAuthEnabled) {
		logger.success(
			`Wechat js-sdk authorization enabled. API is ${chalk.cyan.underline(
				new URL($apiPath, addr).toString()
			)}`
		);
	}
	logger.success(`Server listening on ${chalk.cyan.underline(addr)}`);

	return app;
}

export default run;
