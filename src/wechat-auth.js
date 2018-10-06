'use strict';
const got = require('got');
const chalk = require('chalk');
const {createHash} = require('crypto');
const {logger} = require('./lib/utils');

const ACCESS_TOKEN_TIMEOUT = 7000000,
	JSTICKET_TIMEOUT = 7000000;
let accessToken = null,
	jsTicket = null;

function randomString(len) {
	let text = '',
		possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < len; ++i) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function sha1(str) {
	const hash = createHash('sha1');
	hash.update(str);
	return hash.digest('hex');
}

function getSignature({jsapi_ticket, nonceStr, timestamp, url}) {
	/* eslint camelcase: 0 */
	return sha1(
		`jsapi_ticket=${jsapi_ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`
	);
}

async function getAccessToken(appId, secret) {
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
	const {access_token, errcode, errmsg} = resp.body;

	if (errcode) {
		const err = new Error(`Error code: ${errcode}. ${errmsg}`);
		err.errcode = errcode;
		throw err;
	}
	accessToken = access_token;
	// Access Token过期则JS Ticket跟着过期
	setTimeout(() => ((accessToken = null), (jsTicket = null)), ACCESS_TOKEN_TIMEOUT);
	return accessToken;
}

async function getJSTicket(accessToken) {
	if (jsTicket) {
		return jsTicket;
	}

	const resp = await got(
		`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`,
		{
			json: true
		}
	);
	const {ticket, errcode, errmsg} = resp.body;
	if (parseInt(errcode, 10) != 0) {
		const err = new Error(`Error code: ${errcode}. ${errmsg}`);
		err.errcode = errcode;
		throw err;
	}
	jsTicket = ticket;
	setTimeout(() => (jsTicket = null), JSTICKET_TIMEOUT);
	return jsTicket;
}

async function getToken(appId, secret, retryCount = 0) {
	try {
		const accessToken = await getAccessToken(appId, secret);
		return accessToken;
	} catch (error) {
		// 超过重试次数crash
		if (retryCount > 2) {
			throw error;
		}
		// 如果是微信错误直接crash, 如果网络错误则重试
		if (error.errcode) {
			throw error;
		} else {
			return await getToken(appId, secret, ++retryCount);
		}
	}
}

async function getTicket(accessToken, retryCount) {
	try {
		const jsTicket = await getJSTicket(accessToken);
		return jsTicket;
	} catch (error) {
		if (retryCount > 2) {
			throw error;
		}
		if (error.errcode) {
			throw error;
		} else {
			return await getTicket(accessToken, ++retryCount);
		}
	}
}

// MMP, 竟然没有个正常点的方式获取protocol
function getProtocol(req) {
	if (req.req.socket.encrypted) return 'https';
	const proto = req['X-Forwarded-Proto'] || '';
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
}) {
	return async (req, res) => {
		/* eslint camelcase: 0 */
		const accessToken = await getToken(appId, secret);
		const jsTicket = await getTicket(accessToken);
		const debug = dbg || false;
		const timestamp = ts || Math.floor(Date.now() / 1000);
		const nonceStr = ns || randomString(20);
		const href = new URL(req.req.url, `${getProtocol(req)}://${req.req.hostname}`).toString();
		const url =
			(req.query.url && decodeURIComponent(req.query.url)) ||
			(req.body && req.body.url && decodeURIComponent(req.body.url)) ||
			ul ||
			href;
		const jsApiList =
			(req.query.jsApiList && (Array.isArray(req.query.jsApiList)
				? req.query.jsApiList
				: [req.query.jsApiList])) ||
			(req.body && req.body.jsApiList) ||
			jal ||
			[];
		const signature =
			sig ||
			getSignature({
				jsapi_ticket: jsTicket,
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

async function wechatAuth(
	app,
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
	}
) {
	if (typeof appId !== 'string' || !appId || typeof secret !== 'string' || !secret) {
		throw new TypeError('Expected appId, secret to be a non empty string when wechat is set.');
	}

	if (typeof method === 'string') {
		method = method.toLowerCase();
		if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
			method = 'get';
		}
	} else {
		method = 'get';
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

	app.addHook('onRequest', async req => {
		console.log(`Received request ${chalk.blueBright(req.method)} ${chalk.greenBright(req.url)}.`);
	});

	app.setErrorHandler(async err => {
		logger.error(err.message);
		logger.error(err.stack);
		return err;
	});

	app[method](
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
}

module.exports = wechatAuth;
