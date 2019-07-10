import got from 'got';
import chalk from 'chalk';
import { createHash } from 'crypto';
import { logger, FastifyHTTPMethod, HTTPMethodUpperCase } from './lib/utils';
import { FastifyInstance, FastifyRequest, Plugin } from 'fastify';
import { URL } from 'url';
import { Server, IncomingMessage, ServerResponse } from 'http';

interface CustomError extends Error {
	errcode?: number;
}

const ACCESS_TOKEN_TIMEOUT = 7000000,
	JSTICKET_TIMEOUT = 7000000;
let accessToken: string | null = null,
	jsTicket: string | null = null;

function randomString(len: number): string {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let text = '';
	for (let i = 0; i < len; ++i) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function sha1(str: string): string {
	const hash = createHash('sha1');
	hash.update(str);
	return hash.digest('hex');
}

function getSignature({
	jsapi_ticket,
	nonceStr,
	timestamp,
	url
}: {
	jsapi_ticket: string;
	nonceStr: string;
	timestamp: number;
	url: string;
}): string {
	return sha1(
		`jsapi_ticket=${jsapi_ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`
	);
}

async function getAccessToken(appId: string, secret: string): Promise<string> {
	if (accessToken) {
		return accessToken;
	}
	// 异常向上抛, 由上级处理, retry自己来处理
	const resp = await got(
		`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${secret}`,
		{
			json: true
		}
	);
	const { access_token, errcode, errmsg } = resp.body;

	if (errcode) {
		const err: CustomError = new Error(`Error code: ${errcode}. ${errmsg}`);
		err.errcode = errcode;
		throw err;
	}
	accessToken = access_token;
	// Access Token过期则JS Ticket跟着过期
	setTimeout(() => ((accessToken = null), (jsTicket = null)), ACCESS_TOKEN_TIMEOUT);
	return accessToken!;
}

async function getJSTicket($accessToken: string): Promise<string> {
	if (jsTicket) {
		return jsTicket;
	}

	const resp = await got(
		`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${$accessToken}&type=jsapi`,
		{
			json: true
		}
	);
	const { ticket, errcode, errmsg } = resp.body;
	if (parseInt(errcode, 10) !== 0) {
		const err: CustomError = new Error(`Error code: ${errcode}. ${errmsg}`);
		err.errcode = errcode;
		throw err;
	}
	jsTicket = ticket;
	setTimeout(() => (jsTicket = null), JSTICKET_TIMEOUT);
	return jsTicket!;
}

async function getToken(appId: string, secret: string, retryCount: number = 0): Promise<string> {
	try {
		const $accessToken = await getAccessToken(appId, secret);
		return $accessToken;
	} catch (error) {
		// 超过重试次数crash
		if (retryCount > 2) {
			throw error;
		}
		// 如果是微信错误直接crash, 如果网络错误则重试
		if (error.errcode) {
			throw error;
		} else {
			return await getToken(appId, secret, retryCount + 1);
		}
	}
}

async function getTicket($accessToken: string, retryCount: number = 0): Promise<string> {
	try {
		const $jsTicket = await getJSTicket($accessToken);
		return $jsTicket;
	} catch (error) {
		if (retryCount > 2) {
			throw error;
		}
		if (error.errcode) {
			throw error;
		} else {
			return await getTicket($accessToken, retryCount + 1);
		}
	}
}

// MMP, 竟然没有个正常点的方式获取protocol
function getProtocol(req: FastifyRequest): string {
	// tslint:disable-next-line
	if ((req.raw.socket as any).encrypted) return 'https';
	const proto = req.headers['X-Forwarded-Proto'] || '';
	return proto ? proto.split(/\s*,\s*/)[0] : 'http';
}

function routeHandler({
	appId,
	secret,
	url: ul,
	debug: dbg,
	timestamp: ts,
	nonceStr: ns,
	signature: sig,
	jsApiList: jal
}: WechatOptions): (req: FastifyRequest) => Promise<any> {
	return async (req: FastifyRequest): Promise<any> => {
		const $accessToken = await getToken(appId, secret);
		const $jsTicket = await getTicket($accessToken);
		const debug = dbg || false;
		const timestamp = ts || Math.floor(Date.now() / 1000);
		const nonceStr = ns || randomString(20);
		const href = new URL(req.raw.url || '__UnknownPath__', `${getProtocol(req)}://${req.hostname}`).toString();
		const url =
			(req.query.url && decodeURIComponent(req.query.url)) ||
			(req.body && req.body.url && decodeURIComponent(req.body.url)) ||
			ul ||
			href;
		const jsApiList: string[] =
			(req.query &&
				req.query.jsApiList &&
				(Array.isArray(req.query.jsApiList) ? req.query.jsApiList : [req.query.jsApiList])) ||
			(req.body && Array.isArray(req.body.jsApiList) && req.body.jsApiList) ||
			jal ||
			[];
		const signature =
			sig ||
			getSignature({
				jsapi_ticket: $jsTicket,
				nonceStr,
				timestamp,
				url
			});

		return {
			debug,
			appId,
			timestamp,
			nonceStr,
			signature,
			jsApiList
		};
	};
}

export interface WechatOptions {
	appId: string;
	secret: string;
	path?: string;
	method?: HTTPMethodUpperCase | FastifyHTTPMethod;
	url?: string;
	debug?: boolean;
	timestamp?: number;
	nonceStr?: string;
	signature?: string;
	jsApiList?: Array<string>;
}


const wechatAuth: Plugin<Server, IncomingMessage, ServerResponse, WechatOptions> = async (
	app: FastifyInstance,
	{
		appId,
		secret,
		method,
		url,
		debug,
		timestamp,
		nonceStr,
		signature,
		jsApiList,
		path: apiPath = '/wechat-config'
	}: WechatOptions
): Promise<void> => {
	let $method: FastifyHTTPMethod | null;
	if (typeof appId !== 'string' || !appId || typeof secret !== 'string' || !secret) {
		throw new TypeError('Expected appId, secret to be a non empty string when wechat is set.');
	}

	if (typeof method === 'string') {
		$method = method.toLowerCase() as FastifyHTTPMethod;
		if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all'].includes($method)) {
			$method = 'get';
		}
	} else {
		$method = 'get';
	}

	const options = {
		schema: {
			response: {
				200: {
					type: 'object',
					properties: {
						debug: {
							type: 'boolean'
						},
						appId: {
							type: 'string'
						},
						timestamp: {
							type: 'integer'
						},
						nonceStr: {
							type: 'string'
						},
						signature: {
							type: 'string'
						},
						jsApiList: {
							type: 'array',
							items: {
								type: 'string'
							}
						}
					}
				}
			}
		}
	};

	app.addHook('onRequest', async (req: FastifyRequest) => {
		console.log(
			`Received request ${chalk.blueBright(req.raw.method || 'unknown')} ${chalk.greenBright(
				req.raw.url || 'unknown'
			)}.`
		);
	});

	app.setErrorHandler(
		async (err: Error): Promise<Error> => {
			logger.error(err.message);
			logger.error(err.stack!);
			return err;
		}
	);

	app[$method](
		apiPath,
		options,
		routeHandler({
			appId,
			secret,
			url,
			debug,
			timestamp,
			nonceStr,
			signature,
			jsApiList
		})
	);

	// hard code
	app.get('/__pockAccessToken__', async () => getAccessToken(appId, secret));
};

export default wechatAuth;
