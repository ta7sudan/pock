'use strict';

async function wechatAuth(app, {
	appid,
	secret,
	path: apiPath = '/wechat-config'
}) {
	if (typeof appid !== 'string' || !appid || typeof secret !== 'string' || !secret) {
		throw new TypeError('Expected appid, secret to be a non empty string when wechat is set.');
	}
	
}

module.exports = wechatAuth;