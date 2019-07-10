import {
	Server,
	request,
	IncomingMessage,
	ServerResponse,
	RequestOptions,
	ClientRequest
} from 'http';
import { createConnection, Socket } from 'net';
import chalk from 'chalk';
import { logger } from './lib/utils';
import { URL } from 'url';

function rand(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface MITMOptions {
	port?: number;
	host?: string;
	log?: boolean;
	origin: string;
	dest: string;
}

// 先写个low b版的, 有空再加功能
async function mitm(options: MITMOptions): Promise<Server> {
	// 不在参数解构是考虑到时候也许直接把options传给某个库
	const { origin, dest, log = false, host = '0.0.0.0', port = rand(1025, 65535) } = options;
	if (typeof origin !== 'string' || !origin || typeof dest !== 'string' || !dest) {
		throw new TypeError('origin and dest in mitm options must set correctly.');
	}

	if (origin === dest) {
		throw new Error('Same origin and dest may cause request loop.');
	}

	const [originHostname, originPort = '80'] = origin
		.trim()
		.toLowerCase()
		.split(':');
	const [destHostname, destPort = '80'] = dest
		.trim()
		.toLowerCase()
		.split(':');

	const server = new Server();

	// 目前只支持HTTP代理
	server.on('request', (cReq: IncomingMessage, cRes: ServerResponse): void => {
		if (!cReq.url) {
			logger.error(`Can't get the request url`);
			process.exit(1);
			return;
		}
		const { hostname, port: $$port, pathname } = new URL(cReq.url),
			$port = $$port || '80';

		const opts: RequestOptions = {
			protocol: 'http:',
			method: cReq.method || 'unknown',
			path: pathname,
			headers: cReq.headers,
			hostname: '',
			port: undefined
		};
		if (hostname === originHostname && $port === originPort) {
			opts.hostname = destHostname;
			opts.port = parseInt(destPort, 10);
		} else {
			opts.hostname = hostname;
			opts.port = parseInt($port, 10);
		}
		const sReq = request(opts, (sRes: IncomingMessage) => {
			cRes.writeHead(sRes.statusCode || 500, sRes.statusMessage || 'Unknown Pock Error', sRes.headers);
			sRes.pipe(cRes);
		});

		sReq.on('error', function(this: ClientRequest, err: Error): void {
			log && logger.error(err.message);
			this.end();
		});

		cReq.pipe(sReq);
	});

	server.on('connect', (req: IncomingMessage, cSocket: Socket, header: Buffer): void => {
		if (!req.url) {
			logger.error(`Can't get the request url`);
			process.exit(1);
			return;
		}
		const [hostname, $port = '80'] = req.url.split(':');
		const sSocket = createConnection(parseInt($port, 10) || 443, hostname, function(
			this: Socket
		): void {
			cSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
			this.write(header);
			this.pipe(cSocket).pipe(this);
		});

		sSocket.on('error', function(this: Socket, err: Error): void {
			log && logger.error(err.message);
			this.end();
		});

		cSocket.on('error', function(this: Socket, err: Error): void {
			log && logger.error(err.message);
			this.end();
		});
	});

	server.on('error', (err: Error): void => {
		logger.error(err.message);
	});

	// 什么傻屌操作???
	let resolve: (() => any) | null = null;
	const delayLog = new Promise((rs: () => void): any => (resolve = rs));
	server.listen(parseInt(port as any as string, 10), host, (err?: Error): void => {
		if (err) {
			throw err;
		}
		resolve!();
	});

	await delayLog;
	logger.success(
		`MITM proxy listening on ${chalk.cyan.underline(
			`http://${host}:${port}`
		)} From ${chalk.cyan.underline(origin)} to ${chalk.cyan.underline(dest)}`
	);

	return server;
}

export default mitm;
